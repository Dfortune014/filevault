# Week 1 – Infrastructure Setup (Secure File Vault)

## 🎯 Objectives
- Provision AWS infrastructure using Terraform (Infrastructure as Code).
- Create secure networking, storage, and logging foundations.
- Prepare environment for authentication and file portal in future weeks.

---

## ✅ Deliverables
- **Networking**
  - VPC with CIDR `10.0.0.0/16`
  - Public and private subnets
  - Internet Gateway + NAT Gateway

- **Storage**
  - Encrypted S3 bucket (`secure-file-portal-files`)
  - SSE-KMS enabled with Customer Managed Key
  - Bucket policy requiring encryption
  - CORS configuration for frontend
  - Versioning + lifecycle rules (archive after 30 days, delete after 180)

- **Security**
  - IAM roles:
    - Admin → full S3/KMS access
    - Editor → upload & list
    - Viewer → read-only
  - CloudTrail enabled (multi-region)
  - Dedicated logging bucket

- **IaC**
  - Terraform modules for networking, storage, and security
  - Remote state stored in S3 (`secure-file-portal-tfstate`)
  - State locking via DynamoDB (`secure-file-portal-lock`)

---
## 🧪 Validation Steps
1. **Terraform Plan & Apply**
   ```bash
   terraform plan
   terraform apply

Check the week1-validation.sh for the tests
