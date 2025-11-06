# Phase 5: Advanced Features

## 🎯 Objectives

Phase 5 implements advanced security and management features:
- Multi-Factor Authentication (MFA)
- User management operations
- Role management and delegation
- Delegated access (Editor → Viewer)
- Admin operations
- Enhanced audit logging

## 📋 Table of Contents

1. [Multi-Factor Authentication](#multi-factor-authentication)
2. [User Management](#user-management)
3. [Role Management](#role-management)
4. [Delegated Access](#delegated-access)
5. [Admin Operations](#admin-operations)
6. [Audit Logging](#audit-logging)

---

## 🔐 Multi-Factor Authentication

### MFA Setup Flow

**Step 1: Generate TOTP Secret**

```typescript
// Frontend: Setup MFA
const setupMFA = async () => {
  const result = await setUpTOTP();
  return {
    secretCode: result.sharedSecret,
    qrCode: result.qrCode
  };
};
```

**Step 2: Display QR Code**

```typescript
// components/MFASetup.tsx
export const MFASetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [qrCode, setQrCode] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const handleSetup = async () => {
    const result = await setupMFA();
    setQrCode(result.qrCode);
    setSecretCode(result.secretCode);
  };

  const handleVerify = async () => {
    await verifyTOTPSetup({ code: verificationCode });
    onComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup MFA</CardTitle>
      </CardHeader>
      <CardContent>
        {qrCode ? (
          <>
            <QRCodeSVG value={qrCode} />
            <Input
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <Button onClick={handleVerify}>Verify</Button>
          </>
        ) : (
          <Button onClick={handleSetup}>Generate QR Code</Button>
        )}
      </CardContent>
    </Card>
  );
};
```

**Step 3: Verify and Enable**

```typescript
const verifyMFASetup = async (code: string) => {
  await verifyTOTPSetup({ code });
  toast.success('MFA enabled successfully');
};
```

### MFA Status Check

**Lambda Function:**

```python
# check_mfa_status/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_sub = claims.get('sub')
    user_email = claims.get('email')
    
    # Get user MFA status
    user_response = cognito.admin_get_user(
        UserPoolId=USER_POOL_ID,
        Username=user_email
    )
    
    user_mfa_settings = user_response.get('UserMFASettingList', [])
    preferred_mfa = user_response.get('PreferredMfaSetting', '')
    
    has_totp = (
        'SOFTWARE_TOKEN_MFA' in user_mfa_settings or
        preferred_mfa == 'SOFTWARE_TOKEN_MFA'
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'mfaEnabled': has_totp,
            'hasTotpDevice': has_totp,
            'preferredMfaSetting': preferred_mfa,
            'mfaDevices': len(user_mfa_settings)
        })
    }
```

**Frontend Check:**

```typescript
const isMFAEnabled = async (): Promise<boolean> => {
  const token = await getAuthToken();
  const response = await axios.get(`${API_ENDPOINT}/api/mfa/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.mfaEnabled;
};
```

### MFA Login Flow

```typescript
const login = async (email: string, password: string) => {
  const result = await signIn({ username: email, password });
  
  if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
    // MFA required
    const mfaCode = await promptForMFACode();
    await confirmSignIn({ challengeResponse: mfaCode });
  }
};
```

---

## 👥 User Management

### List Users (Admin Only)

**Lambda Function:**

```python
# users/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Only Admins can list users
    if 'Admins' not in groups:
        return response(403, {'error': 'Forbidden'})
    
    # Query DynamoDB
    result = users_table.scan()
    users = result.get('Items', [])
    
    return response(200, {'users': users, 'count': len(users)})
```

**Frontend:**

```typescript
// pages/Users.tsx
const Users = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const userService = new UserService();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await userService.listUsers();
      setUsers(response.users);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.fullName}</TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <Button onClick={() => handleEditRole(user)}>Edit Role</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
```

### Update User Profile

```typescript
const updateUser = async (userId: string, updates: { fullName: string }) => {
  const token = await getAuthToken();
  const response = await axios.patch(
    `${API_ENDPOINT}/api/users/${userId}`,
    updates,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};
```

### Create User (Admin)

```typescript
const createUser = async (email: string, fullName: string, role: string) => {
  // Create in Cognito
  await cognito.adminCreateUser({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'name', Value: fullName }
    ],
    TemporaryPassword: generateTempPassword(),
    MessageAction: 'SUPPRESS'
  });

  // Add to group
  await cognito.adminAddUserToGroup({
    UserPoolId: USER_POOL_ID,
    Username: email,
    GroupName: role
  });
};
```

---

## 🎭 Role Management

### Update User Role

**Lambda Function:**

```python
# update-role/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    actor_id = claims.get('sub')
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Only Admins can update roles
    if 'Admins' not in groups:
        return response(403, {'error': 'Forbidden'})
    
    # Parse request
    user_id = event['pathParameters']['id']
    body = json.loads(event.get('body', '{}'))
    new_role = body.get('role')
    
    # Update Cognito group
    user_email = users_table.get_item(Key={'userId': user_id})['Item']['email']
    
    # Remove from old group
    old_groups = cognito.admin_list_groups_for_user(
        UserPoolId=USER_POOL_ID,
        Username=user_email
    )['Groups']
    
    for group in old_groups:
        cognito.admin_remove_user_from_group(
            UserPoolId=USER_POOL_ID,
            Username=user_email,
            GroupName=group['GroupName']
        )
    
    # Add to new group
    cognito.admin_add_user_to_group(
        UserPoolId=USER_POOL_ID,
        Username=user_email,
        GroupName=new_role
    )
    
    # Update DynamoDB
    users_table.update_item(
        Key={'userId': user_id},
        UpdateExpression='SET #role = :role, updatedAt = :now',
        ExpressionAttributeNames={'#role': 'role'},
        ExpressionAttributeValues={
            ':role': new_role,
            ':now': datetime.utcnow().isoformat()
        }
    )
    
    # Log audit event
    log_event('UserRoleUpdated', actor={'id': actor_id}, target={'id': user_id})
    
    return response(200, {'message': 'Role updated successfully'})
```

**Frontend:**

```typescript
// pages/ManageRoles.tsx
const ManageRoles = () => {
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await userService.updateRole(userId, newRole);
      toast.success('Role updated successfully');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  return (
    <Select onValueChange={(role) => handleUpdateRole(user.id, role)}>
      <SelectTrigger>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Admin">Admin</SelectItem>
        <SelectItem value="Editor">Editor</SelectItem>
        <SelectItem value="Viewer">Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
};
```

---

## 🔗 Delegated Access

### Concept

**Delegation Model:**
- Editors can be assigned to manage Viewers
- Editors can upload/delete files on behalf of delegated Viewers
- Viewers see files uploaded for them by their Editor

### Update Delegation

**Lambda Function:**

```python
# update_delegate/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    actor_id = claims.get('sub')
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    user_id = event['pathParameters']['id']
    body = json.loads(event.get('body', '{}'))
    editor_id = body.get('editorId')  # null to unlink
    
    # Authorization
    if 'Admins' not in groups and actor_id != editor_id:
        return response(403, {'error': 'Forbidden'})
    
    # Update DynamoDB
    if editor_id:
        users_table.update_item(
            Key={'userId': user_id},
            UpdateExpression='SET delegatedEditor = :editor',
            ExpressionAttributeValues={':editor': editor_id}
        )
    else:
        users_table.update_item(
            Key={'userId': user_id},
            UpdateExpression='REMOVE delegatedEditor'
        )
    
    log_event('DelegateUpdated', actor={'id': actor_id}, target={'id': user_id})
    
    return response(200, {'message': 'Delegation updated'})
```

**Frontend:**

```typescript
// Assign Editor to Viewer
const handleAssignEditor = async (viewerId: string, editorId: string) => {
  await userService.updateDelegate(viewerId, editorId);
  toast.success('Editor assigned');
};

// Unassign Editor
const handleUnassignEditor = async (viewerId: string) => {
  await userService.updateDelegate(viewerId, null);
  toast.success('Editor unassigned');
};
```

### Get Delegated Users

**Lambda Function:**

```python
# get_delegated_users/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    user_id = claims.get('sub')
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Only Editors can access
    if 'Editors' not in groups:
        return response(403, {'error': 'Forbidden'})
    
    # Query delegated viewers
    result = users_table.query(
        IndexName='delegatedEditor-index',
        KeyConditionExpression=Key('delegatedEditor').eq(user_id)
    )
    
    viewers = result.get('Items', [])
    return response(200, {'delegatedViewers': viewers})
```

**Frontend:**

```typescript
// Get delegated viewers for Editor
const loadDelegatedViewers = async () => {
  const response = await userService.getDelegatedUsers();
  setDelegatedViewers(response.delegatedViewers);
};
```

### File Access with Delegation

**Upload for Delegated Viewer:**

```python
# upload/main.py
def handler(event, context):
    # ... existing code ...
    
    target_user_id = body.get('targetUserId')
    
    # Check if Editor can upload for this Viewer
    if target_user_id and target_user_id != user_id:
        if 'Admins' not in groups:
            # Check if target is delegated viewer
            viewer = users_table.get_item(Key={'userId': target_user_id}).get('Item')
            if not viewer or viewer.get('delegatedEditor') != user_id:
                return response(403, {'error': 'Unauthorized'})
    
    # Proceed with upload
    # ...
```

**List Files with Delegation:**

```python
# list/main.py
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

---

## 🛡️ Admin Operations

### Admin Delete

**Lambda Function:**

```python
# admin_delete/main.py
def handler(event, context):
    claims = event['requestContext']['authorizer']['jwt']['claims']
    groups = _normalize_groups(claims.get('cognito:groups', []))
    
    # Only Admins
    if 'Admins' not in groups:
        return response(403, {'error': 'Forbidden'})
    
    file_id = event['pathParameters']['id']
    
    # Get file metadata
    file_item = files_table.get_item(Key={'fileId': file_id})['Item']
    
    # Delete from S3
    s3.delete_object(Bucket=BUCKET_NAME, Key=file_item['s3Key'])
    
    # Delete metadata
    files_table.delete_item(Key={'fileId': file_id})
    
    # Log to admin audit table
    log_event('AdminFileDeleted', actor={'id': user_id}, file_id=file_id, is_admin=True)
    
    return response(200, {'message': 'File deleted'})
```

### User Deletion

```python
def delete_user(user_id: str):
    # Get user email
    user = users_table.get_item(Key={'userId': user_id})['Item']
    
    # Delete from Cognito
    cognito.admin_delete_user(
        UserPoolId=USER_POOL_ID,
        Username=user['email']
    )
    
    # Delete from DynamoDB
    users_table.delete_item(Key={'userId': user_id})
    
    # Delete user's files (optional)
    # ...
```

---

## 📊 Audit Logging

### Enhanced Audit Events

**Event Types:**
- `FileUploaded`
- `FileDownloaded`
- `FileDeleted`
- `AdminFileDeleted`
- `UserRoleUpdated`
- `DelegateUpdated`
- `MFAEnabled`
- `MFADisabled`
- `UserCreated`
- `UserDeleted`

**Audit Record Structure:**

```python
{
    'auditId': 'uuid',
    'eventType': 'FileUploaded',
    'timestamp': '2024-01-01T00:00:00Z',
    'actorUserId': 'user-id',
    'actorEmail': 'user@example.com',
    'targetUserId': 'target-user-id',  # Optional
    'fileId': 'file-id',  # Optional
    'status': 'SUCCESS',
    'ipAddress': '192.168.1.1',
    'details': {
        'fileName': 'document.pdf',
        'size': 1024
    },
    'ttl': 1234567890  # 90 days from now
}
```

### Audit Tables

**General Audit Table:**
- All user operations
- 90-day retention
- TTL-based cleanup

**Deletion Audit Table:**
- Admin deletion operations
- Longer retention (if needed)
- Compliance requirements

### Query Audit Logs

```python
def get_audit_logs(event_type: str, start_date: str, end_date: str):
    # Scan with filter
    result = audit_table.scan(
        FilterExpression=Attr('eventType').eq(event_type) &
                         Attr('timestamp').between(start_date, end_date)
    )
    return result['Items']
```

---

## ✅ Validation

### Test MFA Setup

```bash
# Check MFA status
curl -X GET https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/mfa/status \
  -H "Authorization: Bearer $TOKEN"
```

### Test Role Update

```bash
curl -X PATCH https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/users/{id}/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "Editor"}'
```

### Test Delegation

```bash
# Assign Editor
curl -X PATCH https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/users/{id}/delegate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"editorId": "editor-user-id"}'

# Get delegated users
curl -X GET https://api-id.execute-api.us-east-1.amazonaws.com/dev/api/users/delegated \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔄 Next Steps

After completing Phase 5, review:
- **[Security Best Practices](./security-best-practices.md)** - Security guidelines
- **[Deployment & Operations](./deployment.md)** - Production deployment

---

## 📚 Key Learnings

1. **MFA**: Adds extra security layer
2. **User Management**: Centralized user operations
3. **Role Management**: Dynamic role assignment
4. **Delegation**: Flexible access control model
5. **Audit Logging**: Compliance and security tracking
6. **Admin Operations**: Privileged operations with logging

---

## 🐛 Common Issues

### Issue: MFA not working

**Solution:**
- Check TOTP code timing (30-second window)
- Verify QR code scanned correctly
- Check Cognito MFA configuration

### Issue: Delegation not working

**Solution:**
- Verify GSI exists on users table
- Check delegatedEditor field format
- Verify Editor has correct permissions

### Issue: Role update not reflected

**Solution:**
- Check Cognito group membership
- Verify DynamoDB update
- Clear frontend cache

---

**Phase 5 Complete! ✅** You now have advanced security and management features.

