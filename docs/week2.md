Awesome 👍 let’s make **Week 2 docs** visual with a Mermaid sequence diagram that shows the whole authentication + authorization chain.

Here’s the updated `docs/week2.md` with the diagram appended:

---

# 🔐 Week 2 – Authentication & Authorization Flows

## 1. **User Registration**

* Admin creates users in Cognito (via AWS CLI or frontend signup form).
* New users are assigned a **temporary password**.
* Status = `FORCE_CHANGE_PASSWORD` until the first successful login.

---

## 2. **First Login → `NEW_PASSWORD_REQUIRED`**

* User signs in with email + temporary password.
* Cognito responds with a `NEW_PASSWORD_REQUIRED` challenge.
* User must set a **permanent password**.
* After completion, status updates to `CONFIRMED`.

---

## 3. **Normal Login**

* User logs in with **email + permanent password**.
* Cognito issues three tokens:

  * **ID Token** → contains user info (email, groups, roles).
  * **Access Token** → proves authentication for APIs.
  * **Refresh Token** → allows session renewal without re-login.

---

## 4. **Group-Based Authorization**

* Users are assigned to one Cognito **Group** (`Admins`, `Editors`, `Viewers`).
* Groups are mapped to **IAM Roles** through Cognito Identity Pool:

  * **Admins** → Full access (all AWS actions).
  * **Editors** → Upload/edit only (`s3:PutObject`, `s3:GetObject`, `s3:ListBucket`).
  * **Viewers** → Read-only (`s3:GetObject`, `s3:ListBucket`).
* Cognito embeds group membership (`cognito:groups`) and IAM role (`cognito:roles`) in the ID Token.
* Identity Pool exchanges the ID Token for **temporary AWS STS credentials**.

---

## 5. **Password Recovery**

* If a user forgets their password:

  * Cognito sends a **reset code to their email**.
  * User provides the code + new password.
  * After reset, login resumes with the permanent password.

---

## 6. **Multi-Factor Authentication (MFA) \[Future Enhancement]**

* Currently **disabled** (`mfa_configuration = "OFF"`).
* Later, enable TOTP (Authenticator App) or SMS MFA for stronger security.

---

## 7. **Encryption Enforcement**

* S3 bucket enforces **KMS encryption** for all uploads.
* Uploads must specify:

  ```bash
  aws s3 cp file.txt s3://filevault-files/ \
    --sse aws:kms \
    --sse-kms-key-id <kms_key_id>
  ```
* IAM roles must also have KMS key permissions (`kms:Encrypt`, `kms:Decrypt`, etc.).
* Currently:

  * Admin role has full access.
  * Editor/Viewer roles may require additional KMS permissions (to be refined in Week 3).

---

## 📝 End-to-End Flow

1. User registered in Cognito → assigned group.
2. First login → must set permanent password.
3. Normal login → JWT tokens issued (ID, Access, Refresh).
4. Identity Pool exchanges ID Token for AWS STS credentials.
5. STS credentials assume IAM Role tied to user’s group.
6. IAM Role controls access to **S3 + KMS** according to least-privilege policy.

---

## 🔎 Sequence Diagram

