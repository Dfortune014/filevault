# Deployment & Operations

## 🎯 Overview

This document covers deployment procedures, testing strategies, monitoring, troubleshooting, and cleanup for the FileVault system.

## 📋 Table of Contents

1. [Deployment Procedures](#deployment-procedures)
2. [Testing Strategies](#testing-strategies)
3. [Monitoring & Logging](#monitoring--logging)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Cleanup Procedures](#cleanup-procedures)
6. [Maintenance](#maintenance)

---

## 🚀 Deployment Procedures

### Prerequisites

**Required Tools:**
- Terraform >= 1.5.0
- AWS CLI configured
- Node.js >= 18
- Git

**AWS Account Setup:**
```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### Initial Infrastructure Setup

**Step 1: Create Terraform Backend**

```bash
cd infrastructure/scripts
./setup-backend.sh
```

This creates:
- S3 bucket for Terraform state
- DynamoDB table for state locking

**Step 2: Initialize Terraform**

```bash
cd infrastructure/terraform
terraform init
```

**Step 3: Review Plan**

```bash
terraform plan -out=tfplan
```

**Step 4: Apply Infrastructure**

```bash
terraform apply tfplan
```

**Expected Duration:** 10-15 minutes

### Build Lambda Functions

**Windows:**
```powershell
cd infrastructure/scripts
.\zip-lambdas.ps1
```

**Linux/Mac:**
```bash
cd infrastructure/scripts
./zip-lambdas.sh
```

**Then apply Terraform again:**
```bash
cd ../terraform
terraform apply
```

### Frontend Deployment

**Step 1: Install Dependencies**

```bash
cd frontend
npm install
```

**Step 2: Configure Environment**

Create `.env` file:
```env
VITE_REGION=us-east-1
VITE_USER_POOL_ID=<from terraform output>
VITE_USER_POOL_CLIENT_ID=<from terraform output>
VITE_API_ENDPOINT=<from terraform output>
```

**Get Values:**
```bash
cd infrastructure/terraform
terraform output user_pool_id
terraform output user_pool_client_id
terraform output api_endpoint
```

**Step 3: Build**

```bash
cd frontend
npm run build
```

**Step 4: Deploy (Choose one method)**

#### Option A: AWS Amplify

1. Connect GitHub repository
2. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Base directory: `frontend`
3. Add environment variables
4. Deploy

#### Option B: S3 + CloudFront

```bash
# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

#### Option C: Local Development

```bash
npm run dev
# Access at http://localhost:8080
```

### Post-Deployment Verification

**Check Infrastructure:**
```bash
terraform output
```

**Test API:**
```bash
cd infrastructure/scripts
./test-api.sh
```

**Test Authentication:**
```bash
./test-auth.sh
```

---

## 🧪 Testing Strategies

### Infrastructure Tests

**Terraform Validation:**
```bash
terraform fmt -recursive
terraform validate
terraform plan
```

**Resource Verification:**
```bash
# Check S3 bucket
aws s3 ls | grep filevault

# Check Cognito User Pool
aws cognito-idp list-user-pools --max-results 10

# Check Lambda functions
aws lambda list-functions | grep filevault
```

### API Tests

**Test Scripts:**

```bash
# Test all endpoints
./test-api.sh

# Test role-based access
./test-api-admin.sh
./test-api-editor.sh
./test-api-viewer.sh

# Test file operations
./test-upload.sh
./test-list-files.sh
./test-download.sh
```

**Manual API Testing:**

```bash
# Get auth token
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=Password123! \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Test upload URL
curl -X POST $API_ENDPOINT/api/files/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt", "contentType": "text/plain"}'

# Test list files
curl -X GET $API_ENDPOINT/api/files \
  -H "Authorization: Bearer $TOKEN"
```

### Frontend Tests

**Unit Tests:**
```bash
cd frontend
npm run test
```

**E2E Tests:**
```bash
npm run test:e2e
```

**Manual Testing Checklist:**
- [ ] User registration
- [ ] Email verification
- [ ] Login/logout
- [ ] File upload
- [ ] File download
- [ ] File list
- [ ] File delete (if authorized)
- [ ] Role-based UI rendering
- [ ] MFA setup
- [ ] User management (Admin)
- [ ] Role management (Admin)

### Integration Tests

**Test User Flows:**

1. **Admin Flow:**
   - Create user
   - Assign role
   - Upload file
   - Delete file
   - Manage users

2. **Editor Flow:**
   - Upload file
   - List files
   - Download file
   - Manage delegated viewers

3. **Viewer Flow:**
   - List files
   - Download file
   - Upload file (own)

---

## 📊 Monitoring & Logging

### CloudWatch Logs

**Lambda Function Logs:**

```bash
# View logs
aws logs tail /aws/lambda/filevault-upload --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/filevault-upload \
  --filter-pattern "ERROR"
```

**API Gateway Logs:**

```bash
aws logs tail /aws/apigateway/filevault-api --follow
```

### CloudWatch Metrics

**Key Metrics to Monitor:**

- **Lambda:**
  - Invocations
  - Errors
  - Duration
  - Throttles

- **API Gateway:**
  - Count
  - 4XX errors
  - 5XX errors
  - Latency

- **S3:**
  - Bucket size
  - Number of objects
  - Requests

**Create Dashboard:**

```bash
aws cloudwatch put-dashboard \
  --dashboard-name FileVault \
  --dashboard-body file://dashboard.json
```

### CloudTrail

**View API Calls:**
```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=PutObject \
  --max-results 10
```

**Export Logs:**
```bash
aws s3 sync s3://filevault-audit-logs/ ./cloudtrail-logs/
```

### Application Audit Logs

**Query DynamoDB:**

```python
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
audit_table = dynamodb.Table('FileVaultAudit')

# Query by event type
response = audit_table.query(
    IndexName='eventType-index',
    KeyConditionExpression=Key('eventType').eq('FileUploaded')
)

# Scan with filter
response = audit_table.scan(
    FilterExpression=Attr('timestamp').between('2024-01-01', '2024-01-31')
)
```

### Alarms

**Set Up Alarms:**

```bash
# High error rate
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-high-errors \
  --alarm-description "Alert on high Lambda error rate" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

---

## 🔧 Troubleshooting Guide

### Common Issues

#### Issue: Terraform State Lock

**Symptoms:**
```
Error: Error acquiring the state lock
```

**Solution:**
```bash
# Check lock
aws dynamodb get-item \
  --table-name filevault-lock \
  --key '{"LockID": {"S": "..."}}'

# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

#### Issue: Lambda Function Not Found

**Symptoms:**
```
ResourceNotFoundException: Function not found
```

**Solution:**
```bash
# Rebuild and redeploy Lambda
cd infrastructure/scripts
./zip-lambdas.sh
cd ../terraform
terraform apply
```

#### Issue: CORS Errors

**Symptoms:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
1. Check API Gateway CORS configuration
2. Verify frontend origin is allowed
3. Check preflight OPTIONS requests
4. Review browser console for details

#### Issue: 401 Unauthorized

**Symptoms:**
```
401 Unauthorized
```

**Solution:**
1. Check token expiration
2. Verify token format
3. Check API Gateway authorizer
4. Verify Cognito User Pool configuration

#### Issue: 403 Forbidden

**Symptoms:**
```
403 Forbidden
```

**Solution:**
1. Check user group membership
2. Verify IAM role permissions
3. Check Lambda authorization logic
4. Review DynamoDB query filters

#### Issue: S3 Upload Fails

**Symptoms:**
```
403 Forbidden on S3 upload
```

**Solution:**
1. Check presigned URL expiration
2. Verify KMS encryption headers
3. Check IAM role permissions
4. Verify bucket policy

#### Issue: DynamoDB Query Fails

**Symptoms:**
```
ResourceNotFoundException: Requested resource not found
```

**Solution:**
1. Verify table exists
2. Check GSI configuration
3. Verify attribute names
4. Check IAM permissions

### Debugging Steps

**1. Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/filevault-upload --follow
```

**2. Test API Directly:**
```bash
curl -v -X POST $API_ENDPOINT/api/files/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.txt"}'
```

**3. Verify Infrastructure:**
```bash
terraform show
terraform output
```

**4. Check IAM Permissions:**
```bash
aws iam get-role-policy \
  --role-name filevault-editor-role \
  --policy-name editor-policy
```

**5. Test Cognito:**
```bash
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username test@example.com
```

---

## 🗑️ Cleanup Procedures

### Destroy Infrastructure

**Step 1: Empty S3 Buckets**

```bash
# Empty files bucket
aws s3 rm s3://filevault-dev-*-files --recursive

# Empty audit logs bucket
aws s3 rm s3://filevault-audit-logs --recursive
```

**Step 2: Delete DynamoDB Items (Optional)**

```bash
# Delete all items from tables
aws dynamodb scan \
  --table-name FileVaultFiles \
  --select "COUNT"
```

**Step 3: Destroy Terraform**

```bash
cd infrastructure/terraform
terraform destroy
```

**Note:** Some resources may require manual deletion:
- S3 buckets with versioning
- KMS keys (after deletion window)
- CloudTrail logs

### Manual Cleanup

**Delete S3 Buckets:**
```bash
aws s3 rb s3://bucket-name --force
```

**Delete KMS Key:**
```bash
# Schedule deletion
aws kms schedule-key-deletion \
  --key-id <key-id> \
  --pending-window-in-days 7

# Or cancel deletion
aws kms cancel-key-deletion --key-id <key-id>
```

**Delete CloudTrail:**
```bash
aws cloudtrail delete-trail --name filevault-audit-trail
```

**Delete Cognito User Pool:**
```bash
aws cognito-idp delete-user-pool --user-pool-id $USER_POOL_ID
```

### Cleanup Script

**Windows:**
```powershell
cd infrastructure/scripts
.\destroy-infrastructure.ps1
```

**Linux/Mac:**
```bash
cd infrastructure/scripts
./destroy-infrastructure.sh
```

---

## 🔄 Maintenance

### Regular Tasks

**Weekly:**
- Review CloudWatch alarms
- Check error logs
- Monitor costs

**Monthly:**
- Review access logs
- Check for inactive users
- Update dependencies
- Security patch review

**Quarterly:**
- Full security audit
- Access review
- Disaster recovery test
- Documentation update

### Dependency Updates

**Terraform:**
```bash
terraform init -upgrade
terraform plan
terraform apply
```

**Frontend:**
```bash
cd frontend
npm update
npm audit fix
npm run build
```

**Lambda:**
```bash
# Update Python dependencies
pip install --upgrade boto3
# Rebuild and redeploy
./zip-lambdas.sh
terraform apply
```

### Backup Procedures

**Terraform State:**
- Stored in S3 (versioned)
- Regular backups recommended
- Export state:
```bash
terraform state pull > state-backup.json
```

**DynamoDB:**
- Enable point-in-time recovery
- Regular backups:
```bash
aws dynamodb create-backup \
  --table-name FileVaultFiles \
  --backup-name files-backup-$(date +%Y%m%d)
```

**S3:**
- Versioning enabled
- Cross-region replication (optional)
- Lifecycle policies for archival

### Performance Optimization

**Lambda:**
- Right-size memory allocation
- Optimize cold starts
- Use provisioned concurrency (if needed)

**API Gateway:**
- Enable caching
- Optimize payload sizes
- Use compression

**DynamoDB:**
- Right-size capacity
- Optimize queries
- Use GSIs efficiently

---

## 📚 Additional Resources

### AWS Documentation

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [API Gateway Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/best-practices.html)

### Monitoring Tools

- AWS CloudWatch
- AWS X-Ray (for tracing)
- AWS Systems Manager (for operations)

### Cost Optimization

- AWS Cost Explorer
- AWS Budgets
- Reserved Instances (if applicable)

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] AWS account configured
- [ ] Terraform installed
- [ ] Node.js installed
- [ ] Git repository cloned
- [ ] Environment variables prepared

### Infrastructure

- [ ] Terraform backend configured
- [ ] Infrastructure deployed
- [ ] Lambda functions built and deployed
- [ ] API Gateway configured
- [ ] Cognito User Pool created
- [ ] S3 buckets created
- [ ] DynamoDB tables created

### Application

- [ ] Frontend dependencies installed
- [ ] Environment variables configured
- [ ] Frontend built
- [ ] Frontend deployed

### Verification

- [ ] Infrastructure tests passed
- [ ] API tests passed
- [ ] Frontend tests passed
- [ ] Manual testing completed
- [ ] Monitoring configured
- [ ] Alarms set up

### Post-Deployment

- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring active
- [ ] Backup procedures in place
- [ ] Cleanup procedures documented

---

**Deployment is complete! Monitor the system and address any issues promptly.**

