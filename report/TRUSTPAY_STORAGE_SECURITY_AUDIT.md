# TRUSTPAY ENTERPRISE v2.0 — STORAGE SECURITY AUDIT

**Project:** TrustPay Enterprise v2.0  
**Workspace:** `D:\Payment_mama`  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Module:** Shared Platform Services — File and Document Storage  
**Date:** November 2, 2026  
**Status:** COMPLETE & VERIFIED

---

## 1. Executive Summary

This security audit examines private document storage, upload authorization, download access control, and token cryptography implemented in `apps/api/src/modules/storage/`. The audit confirms that direct public bucket access is disallowed, all storage requests require server-side cryptographic signatures, and HMAC tokens employ constant-time comparison to prevent timing attacks.

---

## 2. Bucket Segregation & Content Policies

Three isolated private bucket categories are enforced in `apps/api/src/modules/storage/storage.schema.ts`:

| Bucket | Max File Size | Permitted MIME Types | Purpose |
| :--- | :--- | :--- | :--- |
| `evidence` | 10 MB (10,485,760 bytes) | `application/pdf`, `image/png`, `image/jpeg`, `application/zip` | Dispute proof, deliverable deliverables, technical specs |
| `agreement-attachments` | 15 MB (15,728,640 bytes) | `application/pdf`, `application/msword`, `application/vnd.openxmlformats...` | Legal schedules, scope briefs, master service agreements |
| `invoices` | 5 MB (5,242,880 bytes) | `application/pdf` | Milestone release statements and tax invoices |

### Enforcement Logic:
Any upload request with an unrecognized MIME type or a size exceeding the quota is rejected with HTTP 400 (`INVALID_MIME_TYPE` or `FILE_TOO_LARGE`) prior to token generation.

---

## 3. Directory Traversal & Object Path Hardening

Object paths are synthesized deterministically on the server:
```ts
const safeBaseName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
const objectPath = `contracts/${contract.id}/${input.bucket}/${crypto.randomUUID()}-${safeBaseName}`;
```

### Path Sanitization Guarantees:
1. **No Directory Traversal:** `input.fileName` is stripped of path separators via `path.basename()` and sanitized with alphanumeric regex.
2. **Path Traversal Rejection on Download:** Any `objectPath` containing `..` or starting with `/` or `\\` is rejected immediately with HTTP 400 `INVALID_OBJECT_PATH`.
3. **Contract Containment:** The object path must strictly match `contracts/${contract.id}/`. Cross-contract retrieval is blocked with HTTP 403 `PATH_CONTRACT_MISMATCH`.

---

## 4. Cryptographic HMAC Tokens & Timing-Safe Verification

Both upload and download authorizations generate base64url-encoded signed tokens. The signature is computed using HMAC-SHA256:

$$\text{Signature} = \text{HMAC-SHA256}(\text{Secret}, \text{Payload})$$

```ts
const expiresIn = 900; // 15 minutes
const expiresAt = Date.now() + expiresIn * 1000;
const payload = `${user.id}:${objectPath}:${expiresAt}`;
const signature = crypto.createHmac('sha256', STORAGE_SECRET).update(payload).digest('hex');
```

### Timing-Safe Verification:
To prevent timing side-channel attacks during string comparison, `crypto.timingSafeEqual` is strictly enforced:

```ts
const sigBuf = Buffer.from(signature, 'hex');
const expBuf = Buffer.from(expectedSig, 'hex');

if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
  throw new Error('Invalid signature');
}

if (Date.now() > expiresAt) {
  throw new Error('Download token expired');
}
```

---

## 5. Audit Findings & Verification Matrix

| Vulnerability Vector | Defense Mechanism | Test Status |
| :--- | :--- | :--- |
| Public Bucket Scraping | Supabase storage bucket configured as strictly private; server proxy required | VERIFIED |
| Directory Traversal (`../../etc/passwd`) | Strict path inspection rejecting `..`, `/`, `\\` | VERIFIED (400 Rejected) |
| Token Tampering / Signature Forgery | HMAC-SHA256 with timing-safe verification | VERIFIED (401 Rejected) |
| Token Replay After Expiration | 15-minute expiration deadline timestamp checked | VERIFIED (401 Expired) |
| Cross-Contract IDOR | Object path prefix must match contract ID and caller must be participant | VERIFIED (403 Forbidden) |
| Malicious Executable Upload | Content-Type whitelist rejecting non-permitted MIME types | VERIFIED (400 Rejected) |

