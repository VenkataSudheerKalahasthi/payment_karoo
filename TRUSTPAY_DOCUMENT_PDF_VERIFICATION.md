# TRUSTPAY ENTERPRISE v2.0 — DOCUMENT & PDF VERIFICATION

**Project:** TrustPay Enterprise v2.0  
**Workspace:** `D:\Payment_mama`  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Module:** Shared Platform Services — Contract PDF Generation & Canonical Hashing  
**Date:** November 2, 2026  
**Status:** COMPLETE & VERIFIED

---

## 1. Executive Summary

This report validates the contract PDF document generation and cryptographic canonical hash verification implemented in `apps/api/src/modules/contracts/contract-pdf.service.ts`. The implementation delivers server-side PDFKit rendering of digital contracts, milestone deliverables, digital acceptance audit trails, and deterministic SHA-256 canonical hashing.

---

## 2. Canonical Contract Hash Specification

To guarantee tamper-evidence and detect any silent discrepancies across contract versions, a deterministic canonical hash is calculated over the normalized contract structure:

```ts
export function computeCanonicalContractHash(input: CanonicalContractHashInput): string {
  const sortedMilestones = (input.milestones || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      amount: Number(m.amount).toFixed(2),
      description: (m.description || '').trim(),
      order: m.order,
      title: (m.title || '').trim(),
    }));

  const canonicalPayload = {
    cancellationTerms: (input.cancellationTerms || '').trim(),
    clientId: input.clientId || '',
    contractNumber: input.contractNumber.trim(),
    currency: (input.currency || 'USD').trim().toUpperCase(),
    milestones: sortedMilestones,
    revisionTerms: (input.revisionTerms || '').trim(),
    scopeOfWork: (input.scopeOfWork || '').trim(),
    termsAndConditions: (input.termsAndConditions || '').trim(),
    title: input.title.trim(),
    totalAmount: Number(input.totalAmount).toFixed(2),
    version: input.version,
    workerId: input.workerId || '',
  };

  const canonicalJson = JSON.stringify(canonicalPayload);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}
```

### Determinism Invariants:
1. **Sorted Milestones:** Milestones are explicitly sorted by `order`.
2. **Normalized Floating Point Precision:** Amounts are normalized to 2 decimal places (`.toFixed(2)`).
3. **Trimmed Whitespace:** String fields are uniformly trimmed.
4. **Normalized Currency:** Currency codes are capitalized and trimmed.

---

## 3. PDFKit Document Generation Architecture

The PDF generation engine compiles full contract specifications into professional A4 documents containing 8 distinct sections:

1. **Header Banner:** TrustPay Enterprise brand, Contract Number, Version, and Lifecycle Status.
2. **Title & Overview:** Project title and executive overview text.
3. **Parties Identification Box:** Client (Buyer) and Worker (Specialist) identities, names, and verified emails.
4. **Commercial Terms:** Total agreed value, currency, milestone distribution, and project timeline.
5. **Scope of Work:** Granular work specifications and deliverable expectations.
6. **Milestone Deliverables Table:** Formatted table with milestone order, title, due date, monetary allocation, and status.
7. **Terms & Cancellation:** General conditions, dispute procedures, and revision terms.
8. **Digital Acceptance & Integrity Audit Trail:**
   - Signer role and verified identity
   - Digital sign-off timestamp (ISO 8601)
   - Clickwrap acceptance method
   - Origin IP address
   - SHA-256 Document Hash checksum
   - Statutory compliance disclaimer (eIDAS / ESIGN Act)

---

## 4. Streaming & Buffer Generation API

Two interfaces are provided:
- `generateContractPdfBuffer(data: ContractPdfData): Promise<Buffer>`: In-memory compilation for automated tests and document archiving.
- `streamContractPdf(res: Response, data: ContractPdfData): void`: Direct streaming to HTTP client with `inline` or `attachment` Content-Disposition header.

---

## 5. Verification Results

| Verification Criterion | Test Method | Result |
| :--- | :--- | :--- |
| PDF Binary Header | Checked buffer begins with `%PDF` (0x25 0x50 0x44 0x46) | PASS |
| Canonical Hash Determinism | Identical input objects produce identical SHA-256 strings | PASS |
| Tamper Sensitivity | Changing 1 character or amount produces an altered hash | PASS |
| Milestone Order Invariance | Shuffled milestone inputs yield identical canonical order | PASS |
| Audit Trail Integrity | Verified signer email, timestamp, IP, and document hash render | PASS |

