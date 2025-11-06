# Phase 1: Infrastructure Foundation

## 🎯 Objectives

In Phase 1, we establish the secure foundation for our FileVault system. This phase focuses on:
- Creating isolated network infrastructure
- Setting up encrypted storage
- Implementing security policies
- Establishing audit logging
- Infrastructure as Code with Terraform

## 📋 Table of Contents

1. [Networking Infrastructure](#networking-infrastructure)
2. [Storage Setup](#storage-setup)
3. [Security Foundations](#security-foundations)
4. [Infrastructure as Code](#infrastructure-as-code)
5. [Validation & Testing](#validation--testing)

---

## 🌐 Networking Infrastructure

### VPC (Virtual Private Cloud)

We create an isolated network environment for our resources:

```hcl
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "filevault-vpc"
  }
}
```

**Key Features:**
- **CIDR Block**: `10.0.0.0/16` provides 65,536 IP addresses
- **Isolation**: Resources within VPC are isolated from other AWS accounts
- **Custom Routing**: Full control over network routing

### Subnets

#### Public Subnet
- **CIDR**: `10.0.1.0/24` (256 IPs)
- **Purpose**: Internet-facing resources (NAT Gateway)
- **Auto-assign Public IP**: Enabled
- **Availability Zone**: `us-east-1a`

#### Private Subnet
- **CIDR**: `10.0.2.0/24` (256 IPs)
- **Purpose**: Internal resources (Lambda functions, databases)
- **No Direct Internet**: Access via NAT Gateway only
- **Availability Zone**: `us-east-1a`

### Internet Gateway

Provides internet access for public subnet resources:

```hcl
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "filevault-igw"
  }
}
```

**Benefits:**
- Enables public subnet resources to access internet
- Required for NAT Gateway functionality

### NAT Gateway

Allows private subnet resources to access the internet while remaining private:

```hcl
resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public.id
  tags = {
    Name = "filevault-nat"
  }
}
```

**Benefits:**
- Private resources can download updates
- Lambda functions can access external APIs
- No direct inbound internet access (security)

### Route Tables

**Public Route Table:**
- Routes `0.0.0.0/0` → Internet Gateway
- Associated with public subnet

**Private Route Table:**
- Routes `0.0.0.0/0` → NAT Gateway
- Associated with private subnet

---

## 💾 Storage Setup

### S3 Bucket Configuration

Our primary storage for files:

```hcl
resource "aws_s3_bucket" "filevault" {
  bucket        = "${var.project_name}-${var.env}-${account_id}-${region}-files"
  force_destroy = false
}
```

**Naming Convention:**
- Includes environment, account ID, and region
- Ensures global uniqueness
- Prevents accidental deletion

**Key Features:**
- **Versioning**: Enabled for file recovery
- **Lifecycle Policies**: Automatic archival and deletion
- **CORS**: Configured for frontend access

### KMS Encryption

**Customer Managed Key (CMK):**

```hcl
resource "aws_kms_key" "filevault" {
  description             = "KMS CMK for FileVault encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  tags = {
    Name = "${var.project_name}-kms"
  }
}
```

**Key Features:**
- **Key Rotation**: Automatically rotates annually
- **Deletion Window**: 10-day grace period for recovery
- **Full Control**: Customer manages key lifecycle

**S3 Encryption Configuration:**

```hcl
resource "aws_s3_bucket_server_side_encryption_configuration" "default" {
  bucket = aws_s3_bucket.filevault.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.filevault.arn
      sse_algorithm     = "aws:kms"
    }
  }
}
```

**Enforcement Policy:**

All uploads MUST use KMS encryption:

```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "${bucket_arn}/*",
  "Condition": {
    "StringNotEquals": {
      "s3:x-amz-server-side-encryption": "aws:kms"
    }
  }
}
```

### CORS Configuration

Enables frontend to access S3 directly:

```hcl
resource "aws_s3_bucket_cors_configuration" "filevault" {
  bucket = aws_s3_bucket.filevault.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"]  # Restrict in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
```

### Versioning

Protects against accidental deletion:

```hcl
resource "aws_s3_bucket_versioning" "filevault" {
  bucket = aws_s3_bucket.filevault.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

**Benefits:**
- Recover deleted files
- Track file history
- Compliance requirements

### Lifecycle Policies

Automated data management:

```hcl
lifecycle_rule {
  id     = "archive-30-days"
  status = "Enabled"
  
  transition {
    days          = 30
    storage_class = "STANDARD_IA"  # Infrequent Access
  }
  
  expiration {
    days = 180  # Auto-delete after 6 months
  }
}
```

**Benefits:**
- Cost optimization (IA storage is cheaper)
- Automatic cleanup of old files
- Compliance with data retention policies

### DynamoDB Tables

**Files Table:**
- Stores file metadata (name, size, owner, S3 key)
- Primary key: `fileId`
- GSI: `ownerId-index` for user file queries

**Users Table:**
- Stores user information (email, name, role)
- Primary key: `userId`
- GSI: `delegatedEditor-index` for delegation queries

**Audit Table:**
- Stores audit logs for compliance
- Primary key: `auditId`
- TTL: 90 days

---

## 🔒 Security Foundations

### IAM Roles

Three role types with least-privilege access:

#### Admin Role
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:*",
    "kms:*"
  ],
  "Resource": "*"
}
```

**Permissions:**
- Full S3 access (read, write, delete)
- Full KMS access (encrypt, decrypt, manage keys)
- User management operations

#### Editor Role
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::filevault-files/*",
    "arn:aws:s3:::filevault-files"
  ],
  "Condition": {
    "StringEquals": {
      "s3:x-amz-server-side-encryption": "aws:kms"
    }
  }
}
```

**Permissions:**
- Upload files (with encryption required)
- Download files
- List files in bucket

#### Viewer Role
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::filevault-files/*",
    "arn:aws:s3:::filevault-files"
  ]
}
```

**Permissions:**
- Download files
- List files in bucket
- No upload or delete access

### CloudTrail

Multi-region audit logging:

```hcl
resource "aws_cloudtrail" "audit" {
  name                          = "filevault-audit-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs.id
  include_global_service_events  = true
  is_multi_region_trail         = true
  enable_logging                = true
}
```

**Captures:**
- All API calls
- User identity
- Source IP address
- Timestamp
- Request/response details

**Use Cases:**
- Security auditing
- Compliance reporting
- Troubleshooting
- Access analysis

### Audit Logging Bucket

Dedicated S3 bucket for CloudTrail logs:

```hcl
resource "aws_s3_bucket" "audit_logs" {
  bucket = "filevault-audit-logs"
  
  lifecycle_rule {
    expiration {
      days = 90  # Retain logs for 90 days
    }
  }
}
```

**Security:**
- Bucket policy denies public access
- Encryption enabled
- Versioning enabled
- Lifecycle policy for retention

---

## 🏗️ Infrastructure as Code

### Terraform Modules

Organized module structure:

```
terraform/
├── modules/
│   ├── networking/    # VPC, subnets, gateways
│   ├── storage/       # S3, KMS, DynamoDB
│   ├── security/     # IAM roles, CloudTrail
│   ├── auth/         # Cognito
│   ├── api/          # API Gateway
│   ├── lambdas/      # Lambda functions
│   └── frontend/     # S3 hosting (optional)
└── main.tf           # Root configuration
```

**Benefits:**
- Reusability
- Maintainability
- Clear separation of concerns
- Easy testing

### Remote State

Stored in S3 with DynamoDB locking:

```hcl
terraform {
  backend "s3" {
    bucket         = "filevault-tfstate"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "filevault-lock"
    encrypt        = true
  }
}
```

**Benefits:**
- Team collaboration
- State locking prevents conflicts
- Encrypted state storage
- Version history

### State Locking

DynamoDB table prevents concurrent modifications:

```hcl
resource "aws_dynamodb_table" "terraform_lock" {
  name           = "filevault-lock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

**How It Works:**
1. Terraform acquires lock before apply
2. Lock stored in DynamoDB
3. Other Terraform runs wait for lock
4. Lock released after apply completes

---

## ✅ Validation & Testing

### Terraform Validation

```bash
# Format code
terraform fmt -recursive

# Validate syntax
terraform validate

# Check plan
terraform plan -out=tfplan
```

### Infrastructure Tests

Run validation script:

```bash
cd infrastructure/scripts
./week1-validation.sh
```

**Tests Include:**
- VPC and subnet creation
- S3 bucket encryption
- KMS key rotation status
- CloudTrail logging
- IAM role policies
- DynamoDB table creation

### Expected Outputs

After `terraform apply`:

```
Outputs:

vpc_id = "vpc-xxxxxxxxx"
bucket_name = "filevault-dev-123456789-us-east-1-files"
kms_key_id = "arn:aws:kms:us-east-1:123456789:key/xxxx-xxxx-xxxx"
cloudtrail_arn = "arn:aws:cloudtrail:us-east-1:123456789:trail/filevault-audit"
files_table_name = "FileVaultFiles"
users_table_name = "FileVaultUsers"
audit_table_name = "FileVaultAudit"
```

### Manual Verification

**Check S3 Encryption:**
```bash
aws s3api get-bucket-encryption \
  --bucket filevault-dev-*-files
```

**Check KMS Key:**
```bash
aws kms describe-key \
  --key-id $(terraform output -raw kms_key_id)
```

**Check CloudTrail:**
```bash
aws cloudtrail get-trail-status \
  --name filevault-audit-trail
```

---

## 📊 Cost Considerations

### Estimated Monthly Costs (Development)

- **VPC**: $0 (no charges for VPC itself)
- **NAT Gateway**: ~$32/month + data transfer ($0.045/GB)
- **S3 Storage**: ~$0.023/GB/month (Standard)
- **S3 Requests**: $0.005 per 1,000 PUT requests
- **KMS**: $1/month per key + $0.03 per 10,000 requests
- **CloudTrail**: First trail free, S3 storage costs apply (~$0.023/GB)
- **DynamoDB**: Pay-per-request, minimal for dev (~$1.25 per million requests)

**Total**: ~$35-50/month for development environment

### Cost Optimization Tips

1. **Use NAT Gateway only when needed** (can use VPC endpoints for AWS services)
2. **Enable S3 lifecycle policies** to move to cheaper storage classes
3. **Delete unused resources** when not developing
4. **Use S3 Intelligent-Tiering** for unpredictable access patterns
5. **Monitor CloudWatch** for unexpected costs
6. **Use Terraform destroy** for non-production environments

---

## 🔄 Next Steps

After completing Phase 1, proceed to:
- **[Phase 2: Authentication & Authorization](./phase2-authentication.md)** - Set up Cognito and user management

---

## 📚 Key Learnings

1. **Network Isolation**: VPC provides logical separation of resources
2. **Encryption**: KMS gives full control over encryption keys
3. **Audit Trail**: CloudTrail provides compliance-ready logging
4. **IaC Benefits**: Terraform enables reproducible infrastructure
5. **Least Privilege**: IAM roles should grant minimum necessary permissions
6. **Cost Management**: Monitor and optimize AWS resource usage

---

## 🐛 Common Issues

### Issue: Terraform state lock

**Solution:**
```bash
# Check lock status
aws dynamodb get-item \
  --table-name filevault-lock \
  --key '{"LockID": {"S": "..."}}'

# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>
```

### Issue: S3 bucket name already exists

**Solution:**
- S3 bucket names are globally unique
- Use account ID and region in naming
- Or use a unique project prefix

### Issue: KMS key deletion

**Solution:**
- Wait for deletion window (10 days)
- Or cancel deletion during window
- Plan key rotation before deletion

---

**Phase 1 Complete! ✅** You now have a secure, encrypted storage foundation.

