# Phase 3: Backend API Development

## 🎯 Objectives

Phase 3 builds the serverless backend API layer. We implement:
- API Gateway HTTP API with Cognito authorization
- Lambda functions for file operations
- Presigned URL generation for secure uploads/downloads
- Role-based access control in Lambda
- Error handling and audit logging

## 📋 Table of Contents

1. [API Gateway Setup](#api-gateway-setup)
2. [Lambda Functions](#lambda-functions)
3. [File Operations](#file-operations)
4. [Authorization & Security](#authorization--security)
5. [Error Handling](#error-handling)
6. [Testing](#testing)

---

## 🌐 API Gateway Setup

### HTTP API Configuration

```hcl
resource "aws_apigatewayv2_api" "this" {
  name          = "secure-file-api"
  protocol_type = "HTTP"
  
  cors_configuration {
    allow_headers = ["Authorization", "Content-Type"]
    allow_methods = ["GET", "PATCH", "POST", "DELETE", "OPTIONS"]
    allow_origins = ["*"]  # Restrict in production
  }
}
```

**Key Features:**
- **HTTP API v2**: Lower latency and cost than REST API
- **CORS**: Configured for frontend access
- **Auto-deploy**: Changes automatically deployed

### Cognito JWT Authorizer

```hcl
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id          = aws_apigatewayv2_api.this.id
  name            = "cognito-authorizer"
  authorizer_type = "JWT"
  
  identity_sources = ["$request.header.Authorization"]
  
  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${var.user_pool_id}"
  }
}
```

**How It Works:**
1. Client sends request with `Authorization: Bearer <token>`
2. API Gateway validates JWT token
3. If valid, request forwarded to Lambda
4. If invalid, returns 401 Unauthorized

### API Stages

```hcl
resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "dev"
  auto_deploy = true
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "prod"
  auto_deploy = true
}
```

**Benefits:**
- Separate environments
- Independent deployments
- Environment-specific configurations

---

## ⚡ Lambda Functions

### Upload Lambda

**Purpose**: Generate presigned URL for file upload

**Endpoint**: `POST /api/files/upload-url`

**Request Body:**
```json
{
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "targetUserId": "optional-user-id"
}
```

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileKey": "user-id/filename-uuid",
  "requiredHeaders": {
    "x-amz-server-side-encryption": "aws:kms",
    "x-amz-server-side-encryption-aws-kms-key-id": "key-id"
  }
}
```

**Lambda Implementation:**
```python
def handler(event, context):
    # Extract user from JWT token
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_id = claims['sub']
    user_email = claims['email']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Parse request
    body = json.loads(event.get('body', '{}'))
    filename = body['filename']
    content_type = body.get('contentType', 'application/octet-stream')
    target_user_id = body.get('targetUserId')
    
    # Authorization check
    if target_user_id and target_user_id != user_id:
        if 'Admins' not in groups:
            return response(403, {'error': 'Unauthorized'})
    
    # Generate presigned URL
    file_key = f"{target_user_id or user_id}/{uuid.uuid4()}-{filename}"
    upload_url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': BUCKET_NAME,
            'Key': file_key,
            'ContentType': content_type,
            'ServerSideEncryption': 'aws:kms',
            'SSEKMSKeyId': KMS_KEY_ID
        },
        ExpiresIn=3600
    )
    
    # Store metadata in DynamoDB
    files_table.put_item(Item={
        'fileId': str(uuid.uuid4()),
        's3Key': file_key,
        'fileName': filename,
        'ownerId': target_user_id or user_id,
        'ownerEmail': user_email,
        'size': 0,  # Updated after upload
        'createdAt': datetime.utcnow().isoformat()
    })
    
    return response(200, {
        'uploadUrl': upload_url,
        'fileKey': file_key,
        'requiredHeaders': {
            'x-amz-server-side-encryption': 'aws:kms',
            'x-amz-server-side-encryption-aws-kms-key-id': KMS_KEY_ID
        }
    })
```

### List Lambda

**Purpose**: List files based on user role

**Endpoint**: `GET /api/files`

**Response:**
```json
{
  "files": [
    {
      "fileId": "uuid",
      "fileName": "document.pdf",
      "size": 1024,
      "ownerEmail": "user@example.com",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

**Role-Based Filtering:**
- **Admins**: See all files
- **Editors**: See own files + delegated viewers' files
- **Viewers**: See own files only

**Lambda Implementation:**
```python
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_id = claims['sub']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Role-based file listing
    if 'Admins' in groups:
        files = _list_all_files()
    elif 'Editors' in groups:
        files = _list_editor_files(user_id)
    else:
        files = _list_viewer_files(user_id)
    
    return response(200, {'files': files, 'count': len(files)})

def _list_editor_files(editor_id):
    # Get delegated viewers
    viewers = users_table.query(
        IndexName='delegatedEditor-index',
        KeyConditionExpression=Key('delegatedEditor').eq(editor_id)
    )['Items']
    
    viewer_ids = [v['userId'] for v in viewers] + [editor_id]
    
    # Query files for editor and delegated viewers
    files = []
    for owner_id in viewer_ids:
        result = files_table.query(
            IndexName='ownerId-index',
            KeyConditionExpression=Key('ownerId').eq(owner_id)
        )
        files.extend(result.get('Items', []))
    
    return files
```

### Download Lambda

**Purpose**: Generate presigned URL for file download

**Endpoint**: `GET /api/files/{id}/download`

**Response:**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "document.pdf"
}
```

**Authorization:**
- Admins: Can download any file
- Editors: Can download own files + delegated viewers' files
- Viewers: Can download own files only

**Lambda Implementation:**
```python
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_id = claims['sub']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    file_id = event['pathParameters']['id']
    file_item = files_table.get_item(Key={'fileId': file_id})['Item']
    
    if not file_item:
        return response(404, {'error': 'File not found'})
    
    # Authorization check
    owner_id = file_item['ownerId']
    if not _can_access_file(user_id, groups, owner_id):
        return response(403, {'error': 'Unauthorized'})
    
    # Generate presigned URL
    download_url = s3.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': BUCKET_NAME,
            'Key': file_item['s3Key']
        },
        ExpiresIn=3600
    )
    
    return response(200, {
        'downloadUrl': download_url,
        'fileName': file_item['fileName']
    })
```

### Delete Lambda

**Purpose**: Delete file (Admins only, or own files)

**Endpoint**: `DELETE /api/files/{id}`

**Authorization:**
- Admins: Can delete any file
- Editors: Can delete own files + delegated viewers' files
- Viewers: Can delete own files only

**Lambda Implementation:**
```python
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_id = claims['sub']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    file_id = event['pathParameters']['id']
    file_item = files_table.get_item(Key={'fileId': file_id})['Item']
    
    if not file_item:
        return response(404, {'error': 'File not found'})
    
    # Authorization check
    owner_id = file_item['ownerId']
    if not _can_delete_file(user_id, groups, owner_id):
        return response(403, {'error': 'Unauthorized'})
    
    # Delete from S3
    s3.delete_object(Bucket=BUCKET_NAME, Key=file_item['s3Key'])
    
    # Delete metadata
    files_table.delete_item(Key={'fileId': file_id})
    
    # Log audit event
    log_event('FileDeleted', actor={'id': user_id}, file_id=file_id)
    
    return response(200, {'message': 'File deleted successfully'})
```

### Users Lambda

**Purpose**: List and manage users (Admins only)

**Endpoint**: `GET /api/users`

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "Editor",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

**Lambda Implementation:**
```python
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Only Admins can list users
    if 'Admins' not in groups:
        return response(403, {'error': 'Forbidden'})
    
    # Scan users table
    result = users_table.scan()
    users = result.get('Items', [])
    
    return response(200, {'users': users, 'count': len(users)})
```

---

## 📁 File Operations

### Presigned URLs

**Why Use Presigned URLs?**
- Direct S3 access (no Lambda proxy)
- Lower latency
- Reduced Lambda costs
- Better performance for large files

**Upload Presigned URL:**
```python
upload_url = s3.generate_presigned_url(
    'put_object',
    Params={
        'Bucket': BUCKET_NAME,
        'Key': file_key,
        'ContentType': content_type,
        'ServerSideEncryption': 'aws:kms',
        'SSEKMSKeyId': KMS_KEY_ID
    },
    ExpiresIn=3600  # 1 hour
)
```

**Download Presigned URL:**
```python
download_url = s3.generate_presigned_url(
    'get_object',
    Params={
        'Bucket': BUCKET_NAME,
        'Key': s3_key
    },
    ExpiresIn=3600  # 1 hour
)
```

**Frontend Usage:**
```typescript
// Get upload URL
const { uploadUrl, requiredHeaders } = await fileService.getUploadUrl(filename);

// Upload directly to S3
await axios.put(uploadUrl, file, {
  headers: requiredHeaders,
  onUploadProgress: (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  }
});
```

### File Metadata Storage

**DynamoDB Schema:**
```python
{
  'fileId': 'uuid',           # Primary key
  's3Key': 'user-id/filename', # S3 object key
  'fileName': 'document.pdf',
  'ownerId': 'user-id',
  'ownerEmail': 'user@example.com',
  'size': 1024,
  'contentType': 'application/pdf',
  'createdAt': '2024-01-01T00:00:00Z',
  'updatedAt': '2024-01-01T00:00:00Z'
}
```

**Global Secondary Indexes:**
- `ownerId-index`: Query files by owner
- Enables efficient role-based filtering

---

## 🔒 Authorization & Security

### Role-Based Access Control

**Helper Function:**
```python
def _can_access_file(user_id, groups, owner_id):
    if 'Admins' in groups:
        return True
    if owner_id == user_id:
        return True
    if 'Editors' in groups:
        # Check if owner is delegated viewer
        viewer = users_table.get_item(Key={'userId': owner_id}).get('Item')
        if viewer and viewer.get('delegatedEditor') == user_id:
            return True
    return False
```

### Defense in Depth

**Multiple Layers:**
1. **API Gateway**: JWT token validation
2. **Lambda**: Group membership check
3. **DynamoDB**: Query filtering by owner
4. **S3**: IAM role-based access

**Example:**
```python
# Layer 1: API Gateway validates JWT
# Layer 2: Lambda checks groups
if 'Admins' not in groups:
    return response(403, {'error': 'Forbidden'})

# Layer 3: DynamoDB query filtered by owner
files = files_table.query(
    IndexName='ownerId-index',
    KeyConditionExpression=Key('ownerId').eq(user_id)
)

# Layer 4: S3 presigned URL only for authorized files
```

### Audit Logging

**Log All Operations:**
```python
def log_event(event_type, actor, target=None, file_id=None, status='SUCCESS', details=None, ip=None):
    record = {
        'auditId': str(uuid.uuid4()),
        'eventType': event_type,
        'timestamp': datetime.utcnow().isoformat(),
        'actorUserId': actor.get('id'),
        'actorEmail': actor.get('email'),
        'targetUserId': target.get('id') if target else None,
        'fileId': file_id,
        'status': status,
        'ipAddress': ip,
        'details': details or {},
        'ttl': int((datetime.utcnow() + timedelta(days=90)).timestamp())
    }
    audit_table.put_item(Item=record)
```

**Event Types:**
- `FileUploaded`
- `FileDownloaded`
- `FileDeleted`
- `FilesListed`
- `UserRoleUpdated`
- `DelegateUpdated`

---

## ⚠️ Error Handling

### Standard Error Response

```python
def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def failure(message, status_code=500):
    return response(status_code, {'error': message})
```

### Error Types

**400 Bad Request:**
```python
if not filename:
    return response(400, {'error': 'Missing filename'})
```

**401 Unauthorized:**
```python
if not user_id:
    return response(401, {'error': 'Invalid token'})
```

**403 Forbidden:**
```python
if 'Admins' not in groups:
    return response(403, {'error': 'Forbidden'})
```

**404 Not Found:**
```python
if not file_item:
    return response(404, {'error': 'File not found'})
```

**500 Internal Server Error:**
```python
try:
    # Operation
except Exception as e:
    print(f'ERROR: {e}')
    return response(500, {'error': 'Internal server error'})
```

### Frontend Error Handling

```typescript
try {
  const response = await fileService.listFiles();
} catch (error: any) {
  if (error.response?.status === 401) {
    // Token expired, redirect to login
    navigate('/auth');
  } else if (error.response?.status === 403) {
    // Insufficient permissions
    toast.error('You do not have permission to perform this action');
  } else {
    // Generic error
    toast.error('An error occurred');
  }
}
```

---

## 🧪 Testing

### Test Scripts

**Test Upload:**
```bash
./test-upload.sh
```

**Test List:**
```bash
./test-list-files.sh
```

**Test Download:**
```bash
./test-api.sh
```

**Test Role-Based Access:**
```bash
./test-api-admin.sh
./test-api-editor.sh
./test-api-viewer.sh
```

### Manual Testing

**Get Auth Token:**
```bash
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=Password123! \
  --query 'AuthenticationResult.IdToken' \
  --output text)
```

**Test Upload URL:**
```bash
curl -X POST https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/files/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "contentType": "text/plain"}'
```

**Test List Files:**
```bash
curl -X GET https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/files \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Results

- Upload URL generated with KMS encryption headers
- Files listed based on user role
- Download URL generated for authorized files
- Delete only works for authorized users
- All operations logged in audit table

---

## 📊 API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/files/upload-url` | Get presigned upload URL | Yes |
| GET | `/api/files` | List files | Yes |
| GET | `/api/files/{id}/download` | Get presigned download URL | Yes |
| DELETE | `/api/files/{id}` | Delete file | Yes |
| GET | `/api/users` | List users (Admin only) | Yes |
| PATCH | `/api/users/{id}` | Update user (Admin only) | Yes |
| PATCH | `/api/users/{id}/role` | Update user role (Admin only) | Yes |
| PATCH | `/api/users/{id}/delegate` | Update delegation (Admin/Editor) | Yes |
| GET | `/api/users/delegated` | Get delegated users (Editor only) | Yes |

---

## 🔄 Next Steps

After completing Phase 3, proceed to:
- **[Phase 4: Frontend Application](./phase4-frontend.md)** - Build React UI

---

## 📚 Key Learnings

1. **API Gateway**: HTTP API v2 for better performance
2. **Lambda Functions**: Serverless compute for API logic
3. **Presigned URLs**: Direct S3 access for better performance
4. **Role-Based Access**: Implement at multiple layers
5. **Error Handling**: Consistent error responses
6. **Audit Logging**: Track all operations for compliance

---

## 🐛 Common Issues

### Issue: CORS errors

**Solution:**
- Check API Gateway CORS configuration
- Verify frontend origin is allowed
- Check preflight OPTIONS requests

### Issue: 401 Unauthorized

**Solution:**
- Verify token is valid
- Check token expiration
- Ensure token sent in Authorization header

### Issue: 403 Forbidden

**Solution:**
- Check user group membership
- Verify IAM role permissions
- Check Lambda authorization logic

---

**Phase 3 Complete! ✅** You now have a secure, serverless backend API.

