# Phase 2: Authentication & Authorization

## 🎯 Objectives

Phase 2 establishes secure user authentication and role-based access control. We implement:
- AWS Cognito User Pool for user management
- Password policies and security
- Role-based groups (Admin, Editor, Viewer)
- Cognito Identity Pool for AWS credentials
- Token-based authentication flows

## 📋 Table of Contents

1. [Cognito User Pool](#cognito-user-pool)
2. [User Registration](#user-registration)
3. [Authentication Flows](#authentication-flows)
4. [Role-Based Access Control](#role-based-access-control)
5. [Identity Pool & STS](#identity-pool--sts)
6. [Password Recovery](#password-recovery)

---

## 👥 Cognito User Pool

### Configuration

```hcl
resource "aws_cognito_user_pool" "this" {
  name = "filevault-pool"
  
  auto_verified_attributes = ["email"]
  
  password_policy {
    minimum_length    = 10
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase  = true
    temporary_password_validity_days = 7
  }
  
  mfa_configuration = "OPTIONAL"
  
  software_token_mfa_configuration {
    enabled = true
  }
}
```

**Key Features:**
- **Email Verification**: Automatic email verification
- **Strong Passwords**: 10+ characters with complexity requirements
- **MFA Support**: Optional TOTP (Time-based One-Time Password)
- **Temporary Passwords**: 7-day validity for admin-created users

### User Pool Client

```hcl
resource "aws_cognito_user_pool_client" "this" {
  name         = "filevault-client"
  user_pool_id = aws_cognito_user_pool.this.id
  
  generate_secret = false  # Public client for web apps
  
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",        # Secure Remote Password
    "ALLOW_REFRESH_TOKEN_AUTH",   # Session refresh
    "ALLOW_USER_PASSWORD_AUTH"    # Direct password auth
  ]
  
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
  
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30
}
```

**Auth Flows Explained:**
- **SRP**: Secure Remote Password protocol (recommended for web)
- **Refresh Token**: Allows token renewal without re-login
- **Password Auth**: Direct authentication (for testing/CLI)

**Token Validity:**
- Access Token: 1 hour
- ID Token: 1 hour
- Refresh Token: 30 days

---

## 📝 User Registration

### Admin-Created Users

Admins can create users via AWS CLI or frontend:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

**User Status Flow:**
1. **FORCE_CHANGE_PASSWORD** → User must set permanent password
2. **CONFIRMED** → User can log in normally

**First Login:**
```typescript
const result = await signIn({ username, password });

if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
  await confirmSignIn({ challengeResponse: newPassword });
}
```

### Self-Registration

Users can register via frontend:

```typescript
await signUp({
  username: email,
  password: password,
  options: {
    userAttributes: {
      email: email,
      name: fullName
    }
  }
});
```

**Status Flow:**
1. **UNCONFIRMED** → Email verification required
2. **CONFIRMED** → User can log in

**Email Verification:**
```typescript
await confirmSignUp({
  username: email,
  confirmationCode: code
});
```

### Post-Confirmation Lambda

Automatically creates user record in DynamoDB:

```python
def lambda_handler(event, context):
    user_id = event['request']['userAttributes']['sub']
    email = event['request']['userAttributes']['email']
    full_name = event['request']['userAttributes'].get('name', '')
    
    # Check if user already exists
    existing = users_table.get_item(Key={'userId': user_id})
    if 'Item' in existing:
        return event  # Skip if exists
    
    # Add to Viewers group if not in any group
    groups = cognito.admin_list_groups_for_user(
        UserPoolId=user_pool_id,
        Username=username
    ).get('Groups', [])
    
    if not groups:
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName='Viewers'
        )
    
    # Create user record
    users_table.put_item(Item={
        'userId': user_id,
        'email': email,
        'name': full_name,
        'role': 'Viewer',
        'createdAt': datetime.utcnow().isoformat()
    })
    
    return event
```

**Benefits:**
- Automatic user record creation
- Default role assignment
- Consistent data model

---

## 🔐 Authentication Flows

### First Login (Password Change Required)

**Scenario**: Admin creates user with temporary password

```
1. User → Cognito: Login with temp password
2. Cognito → User: NEW_PASSWORD_REQUIRED challenge
3. User → Cognito: New permanent password
4. Cognito → User: Tokens (ID, Access, Refresh)
```

**Code Example:**
```typescript
const result = await signIn({ username, password });

if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
  await confirmSignIn({ challengeResponse: newPassword });
}
```

### Normal Login

**Flow:**
```
1. User → Cognito: Email + Password
2. Cognito → User: JWT Tokens
   - ID Token (user info, groups)
   - Access Token (API authorization)
   - Refresh Token (session renewal)
```

**Token Contents:**

**ID Token:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "cognito:groups": ["Editors"],
  "cognito:username": "user@example.com",
  "exp": 1234567890,
  "iat": 1234564290
}
```

**Access Token:**
```json
{
  "sub": "user-uuid",
  "scope": "aws.cognito.signin.user.admin",
  "exp": 1234567890
}
```

**Frontend Implementation:**
```typescript
const result = await signIn({ username, password });
const session = await fetchAuthSession();
const idToken = session.tokens?.idToken?.toString();
```

### MFA Login (if enabled)

```
1. User → Cognito: Email + Password
2. Cognito → User: MFA_REQUIRED challenge
3. User → Cognito: TOTP code from authenticator app
4. Cognito → User: Tokens
```

**Code Example:**
```typescript
const result = await signIn({ username, password });

if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
  const mfaCode = await getUserInput(); // From authenticator app
  await confirmSignIn({ challengeResponse: mfaCode });
}
```

### Token Refresh

Tokens expire after 1 hour. Refresh using:

```typescript
const session = await fetchAuthSession({ forceRefresh: true });
// Automatically uses refresh token if valid
```

---

## 👮 Role-Based Access Control

### Cognito Groups

Three groups with different permissions:

```hcl
resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Full system access"
  precedence   = 1
}

resource "aws_cognito_user_group" "editors" {
  name         = "Editors"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Upload and download files"
  precedence   = 2
}

resource "aws_cognito_user_group" "viewers" {
  name         = "Viewers"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Read-only access"
  precedence   = 3
}
```

**Precedence:**
- Lower number = higher priority
- If user in multiple groups, highest precedence applies

### Group Assignment

**Via AWS CLI:**
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com \
  --group-name Editors
```

**Via Frontend (Admin only):**
```typescript
await updateUserRole(userId, 'Editors');
```

**Check User Groups:**
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username user@example.com
```

### Group-to-IAM Role Mapping

Groups are mapped to IAM roles via Identity Pool:

```hcl
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id
  
  role_mapping {
    identity_provider = "cognito-idp.us-east-1.amazonaws.com/${user_pool_id}"
    
    # Map groups to IAM roles
    "cognito-idp.us-east-1.amazonaws.com/${user_pool_id}:Admins" = admin_role_arn
    "cognito-idp.us-east-1.amazonaws.com/${user_pool_id}:Editors" = editor_role_arn
    "cognito-idp.us-east-1.amazonaws.com/${user_pool_id}:Viewers" = viewer_role_arn
  }
}
```

**How It Works:**
1. User logs in → receives ID token with groups
2. Identity Pool reads groups from token
3. Maps group to IAM role
4. Returns temporary AWS credentials

---

## 🔑 Identity Pool & STS

### Cognito Identity Pool

Allows users to obtain temporary AWS credentials:

```hcl
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "filevault_identity_pool"
  allow_unauthenticated_identities = false
  
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.this.id
    provider_name           = "cognito-idp.us-east-1.amazonaws.com/${user_pool_id}"
    server_side_token_check = true
  }
}
```

**Key Features:**
- **Authenticated Only**: No anonymous access
- **Token Validation**: Server-side validation for security
- **Role Mapping**: Groups determine IAM role

### STS Credentials Flow

```
1. User → Identity Pool: ID Token from Cognito
2. Identity Pool → STS: Exchange token for credentials
3. STS → User: Temporary AWS credentials
   - Access Key ID
   - Secret Access Key
   - Session Token
   - Expiration (1 hour default)
```

**Use Case:**
- Direct S3 access from frontend
- Presigned URL generation
- Client-side file operations

**Frontend Implementation:**
```typescript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession();
const credentials = session.credentials;

// Use credentials for AWS SDK calls
const s3Client = new S3Client({
  credentials: {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken
  }
});
```

### Credential Refresh

Credentials expire after 1 hour. Refresh using:

```typescript
const session = await fetchAuthSession({ forceRefresh: true });
// Credentials automatically refreshed if refresh token is valid
```

---

## 🔄 Password Recovery

### Forgot Password Flow

```
1. User → Cognito: Request password reset
2. Cognito → User Email: Verification code
3. User → Cognito: Code + New password
4. Cognito → User: Password reset confirmation
```

**Frontend Implementation:**
```typescript
// Step 1: Request reset code
await resetPassword({ username: email });

// Step 2: Confirm with code
await confirmResetPassword({
  username: email,
  confirmationCode: code,
  newPassword: newPassword
});
```

### Password Policy Enforcement

Cognito enforces:
- Minimum 10 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Validation:**
- Client-side validation (UX)
- Server-side enforcement (security)

**Error Handling:**
```typescript
try {
  await resetPassword({ username: email });
} catch (error) {
  if (error.name === 'InvalidParameterException') {
    // Password doesn't meet policy
  } else if (error.name === 'UserNotFoundException') {
    // User doesn't exist
  }
}
```

---

## 🔒 Security Features

### Token Expiration

- **ID Token**: 1 hour
- **Access Token**: 1 hour
- **Refresh Token**: 30 days

**Best Practices:**
- Store tokens securely (not in localStorage for sensitive apps)
- Refresh tokens before expiration
- Handle token expiration gracefully

### Token Validation

API Gateway validates tokens:
```hcl
resource "aws_apigatewayv2_authorizer" "cognito" {
  authorizer_type = "JWT"
  jwt_configuration {
    audience = [user_pool_client_id]
    issuer   = "https://cognito-idp.${region}.amazonaws.com/${user_pool_id}"
  }
}
```

**Validation Checks:**
- Token signature
- Expiration time
- Audience (client ID)
- Issuer (Cognito User Pool)

### Session Management

**Auto-logout on inactivity:**
- 5 minutes of inactivity → Warning
- 6 minutes total → Automatic logout

**Frontend Implementation:**
```typescript
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 1 * 60 * 1000; // 1 minute warning

// Track user activity
document.addEventListener('mousedown', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    showWarning();
    setTimeout(logout, WARNING_TIME);
  }, INACTIVITY_TIMEOUT);
}
```

---

## 📊 User Lifecycle

```
┌─────────────┐
│   Created   │ (Admin creates or self-registers)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Unconfirmed │ (Email verification pending)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Confirmed  │ (Can log in)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Active    │ (Logged in, using system)
└─────────────┘
```

**Status Transitions:**
- `FORCE_CHANGE_PASSWORD` → `CONFIRMED` (after password change)
- `UNCONFIRMED` → `CONFIRMED` (after email verification)
- `CONFIRMED` → Active (after login)

---

## ✅ Validation

### Test Authentication

```bash
# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com \
  --temporary-password TempPass123!

# Test login
aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters \
    USERNAME=test@example.com,PASSWORD=TempPass123!
```

### Expected Results

- User created with `FORCE_CHANGE_PASSWORD` status
- Login returns `NEW_PASSWORD_REQUIRED` challenge
- After password change, user can log in normally
- Tokens contain group membership
- Identity Pool returns AWS credentials

### Frontend Testing

```typescript
// Test login
const result = await signIn({ username, password });
expect(result.isSignedIn).toBe(true);

// Test token
const session = await fetchAuthSession();
expect(session.tokens?.idToken).toBeDefined();

// Test group membership
const decoded = jwtDecode(session.tokens?.idToken);
expect(decoded['cognito:groups']).toContain('Editors');
```

---

## 🔄 Next Steps

After completing Phase 2, proceed to:
- **[Phase 3: Backend API Development](./phase3-backend-api.md)** - Build Lambda functions and API Gateway

---

## 📚 Key Learnings

1. **Cognito User Pool**: Managed authentication service
2. **Groups**: Simple way to implement RBAC
3. **Identity Pool**: Enables AWS credential access
4. **Token Security**: JWT tokens provide stateless authentication
5. **Password Policies**: Balance security with usability
6. **Session Management**: Implement auto-logout for security

---

## 🐛 Common Issues

### Issue: User not in any group

**Solution:**
- Post-confirmation Lambda adds to Viewers by default
- Or manually add via AWS CLI or frontend

### Issue: Token expired

**Solution:**
- Implement token refresh logic
- Check token expiration before API calls
- Handle 401 errors gracefully

### Issue: Identity Pool not returning credentials

**Solution:**
- Check group-to-role mapping
- Verify token contains groups
- Check IAM role trust policy

---

**Phase 2 Complete! ✅** Users can now authenticate and access resources based on their roles.

