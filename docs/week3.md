# Week 3 – Backend API Development

## ✅ Objectives
In Week 3, we built and secured the **backend API layer** for the Secure File Vault.  
The API is responsible for generating presigned URLs, listing files, downloading, and deleting documents stored in S3 with KMS encryption.  

Key components:
- **API Gateway (HTTP API v2)** with Cognito JWT Authorizer.
- **Lambda functions** (Upload, List, Download, Delete).
- **IAM least-privilege execution roles** per Lambda.
- **Cognito group checks inside Lambda** for defense-in-depth.
- **End-to-end tests** for Admin, Editor, and Viewer roles.

---

## 🔐 API Endpoints

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| POST   | `/api/files/upload-url`       | Generate presigned upload URL   |
| GET    | `/api/files`                  | List available files            |
| GET    | `/api/files/{id}/download`    | Generate presigned download URL |
| DELETE | `/api/files/{id}`             | Delete file (Admins only)       |

Base URL (dev stage):  
POST /api/files/upload-url ... 200
GET /api/files ... 200
GET /api/files/test.txt/download ... 200
DELETE /api/files/test.txt ... 403
