# 🔐 Secure File Vault

A production-grade secure file sharing portal for sensitive business/legal documents, built with **AWS**, **Terraform**, and (soon) a **Next.js frontend**.  

The project is structured as a **multi-week build**, with security-first practices like Cognito authentication, IAM least privilege, KMS encryption, and role-based API access.

---

## 📂 Repository Structure

filevault/
├── docs/ # Project documentation (week-by-week)
│ ├── week1.md # Week 1: Storage + KMS
│ ├── week2.md # Week 2: Authentication + IAM
│ ├── week3.md # Week 3: API + Lambda backend
├── frontend/ # Next.js frontend (planned for Week 4+)
└── infrastructure/ # Terraform infrastructure as code
├── terraform/ # Terraform modules for AWS resources
└── scripts/ # Helper scripts for testing + packaging


---

## 🚀 Project Goals

- **Secure File Sharing**: Upload, download, and manage sensitive files safely.
- **Cloud Security Best Practices**:
  - AWS S3 with KMS encryption
  - Cognito authentication + MFA-ready
  - IAM least-privilege role mappings
  - API Gateway with JWT authorizers
- **Extensible Architecture**: Terraform-managed infrastructure with room for multi-cloud expansion.

---

## 📖 Documentation

- [Week 1 – Storage & Security](./docs/week1.md)  
- [Week 2 – Authentication & IAM](./docs/week2.md)  
- [Week 3 – API & Lambda Backend](./docs/week3.md)  

---

## 🛠️ Tech Stack

- **Infrastructure**: Terraform, AWS (S3, KMS, Cognito, API Gateway, Lambda)  
- **Frontend**: Next.js (Week 4)  
- **Security**: IAM least-privilege, Cognito role mapping, SSE-KMS  
- **Automation**: Test scripts (`test-s3-access.sh`, `test-api.sh`, etc.)

---

## 📌 Next Steps

- Week 4 → Frontend integration (Next.js UI with Cognito login).  
- Week 5 → Production hardening (CloudFront, WAF, logging).  
- Extended → Multi-cloud support (Azure/GCP) + CI/CD.  

---

## 👤 Author

Fortune Linus – Cloud Security Engineer 
[LinkedIn](https://www.linkedin.com/in/fortunelinus) • [Portfolio](https://fortunelinus.com)
