# TRUSTPAY ENTERPRISE v2.0
# CLIENT PORTAL — COMPLETE FUNCTIONAL AUDIT

**Project:** TrustPay Enterprise v2.0  
**Workspace:** `D:\Payment_mama`  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Date of Audit:** November 2026  
**Auditor Role:** Principal Full-Stack Engineer, Node.js Backend Architect, PostgreSQL Database Engineer & Application Security Engineer  

---

## 1. EXECUTIVE SUMMARY & SYSTEM ARCHITECTURE

An exhaustive end-to-end functional audit was executed across the **Client Portal** within TrustPay Enterprise v2.0. The audit scrutinized all client-facing workflows across the monorepo architecture:
- **Frontend Layer (`apps/web`):** Client navigation, marketplace discovery, shortlisting, proposal creation, bilateral contract signing, deliverable review, revision workflows, milestone approval, dispute initiation, contract amendments, and telemetry dashboards.
- **Backend API Layer (`apps/api`):** Role-based access control (`UserRole.CLIENT`), hiring request lifecycle, contract state machine, milestone submissions, revision requests, dispute handling, and cryptographic hash verification.
- **Database & Persistence (`prisma/schema.prisma`):** PostgreSQL schema relations across `User`, `ClientProfile`, `WorkerProfile`, `HiringRequest`, `Contract`, `ContractMilestone`, `MilestoneSubmission`, `RevisionRequest`, `Dispute`, and `ContractAmendment`.
- **Shared Types (`packages/shared`):** Data Transfer Objects (DTOs), Zod schemas, and validation contracts.

### Critical Safety & Operational Directives Enforced:
1. **Cashfree Live Movement Deferred:**
   - In accordance with Phase 8 decisions, Cashfree integration is deferred.
   - Financial operations operate under strict safety flags:
     - `isLiveMoneyDisabled = true`
     - `PAYMENTS_LIVE_ENABLED = false`
     - `ESCROW_LIVE_MOVEMENT_ENABLED = false`
     - `PAYOUTS_ENABLED = false`
   - Client milestone approvals and contract completions are strictly recorded in the database without unverified third-party payment gateway debits or bank payouts.
2. **Strict Multi-Tenant & Role Isolation:**
   - Clients are strictly barred from worker-specific actions (e.g., submitting milestone deliverables, editing worker profiles) with `403 Forbidden`.
   - Clients cannot view or modify contracts or proposals belonging to other client accounts (IDOR protection).

---

## 2. FUNCTIONAL AUDIT MATRIX BY CLIENT CAPABILITY

| Capability Area | Specification Requirement | Audit Status | Implementation & Validation Summary |
| :--- | :--- | :--- | :--- |
| **1. Registration & Role Selection** | Clerk authentication sync, role onboarding modal, default `ClientProfile` provisioning. | **Passed** | Client role assignment persists `User` with `role: CLIENT` and initializes `ClientProfile`. Prevents re-selection once bound. |
| **2. Specialist Discovery Marketplace** | Browse specialists, filter by skills, hourly rate ranges, availability, and search by headline/bio. | **Passed** | `GET /api/v1/workers/public` implements server-side filtering, case-insensitive keyword search, and pagination. |
| **3. Specialist Public Profile View** | Inspect specialist qualifications, verified skills, portfolio projects, and availability. | **Passed** | Returns public attributes only. Strictly strips private emails, phone numbers, and internal IDs. |
| **4. Specialist Shortlisting** | Bookmark specialists for future project proposals, view shortlist, remove from shortlist. | **Passed** | Managed via `POST/GET/DELETE /api/v1/shortlist`. Database enforces composite unique constraint `(userId, workerProfileId)`. |
| **5. Hiring Proposal Initiation** | Create formal hiring request with title, description, budget, delivery dates, and milestone breakdown. | **Passed** | `POST /api/v1/hiring-requests` validates inputs via Zod, links to recipient `workerProfileId`, and transitions to `PENDING`. |
| **6. Proposal Negotiation Review** | Review worker responses: acceptance, decline, or counteroffers with adjusted budgets/timelines. | **Passed** | Displays worker counteroffer notes, proposed budget, and proposed dates. Client can accept counteroffer or withdraw proposal. |
| **7. Conversion to Contract** | Convert accepted hiring proposal directly into a legally binding digital contract. | **Passed** | `POST /api/v1/hiring-requests/:id/convert-to-contract` creates `Contract` with `Milestones` derived from proposal terms. |
| **8. Digital Contract Review & Sign** | Review contract terms, milestone schedule, and canonical SHA-256 hash before bilateral acceptance. | **Passed** | Generates deterministic SHA-256 agreement hash. Client marks `clientAccepted = true`. Contract remains `DRAFT` until Worker signs. |
| **9. Deliverable Inspection** | Review submitted work, deliverable notes, submission timestamps, and download files from signed storage. | **Passed** | Fixed nested submission DTO typing (`MilestoneSubmissionDto[]`). Client can view all historical submissions and revision logs. |
| **10. Milestone Revision Requests** | Request revisions with constructive feedback when deliverable does not meet requirements. | **Passed** | `POST /api/v1/contracts/:id/milestones/:mId/revision` transitions milestone to `REVISION_REQUESTED` and notifies worker. |
| **11. Milestone Approval** | Approve completed deliverables upon satisfactory review. | **Passed** | `PUT /api/v1/contracts/:id/milestones/:mId/approve` transitions milestone to `APPROVED`. Safely isolated from live payout movements. |
| **12. Dispute Raising & Mediation** | Raise formal dispute against milestone with evidence files and dispute summary. | **Passed** | `POST /api/v1/disputes` freezes milestone in `DISPUTED`. Prepares dispute for Admin and Superadmin arbitration. |
| **13. Contract Amendments** | Propose scope, budget, or milestone modifications to active contracts. | **Passed** | `POST /api/v1/contracts/:id/amendments` initiates bilateral voting. Both parties must vote `ACCEPT` before changes apply. |
| **14. Legal Contract PDF Export** | Generate tamper-evident PDF containing agreement details, parties, SHA-256 digest, and signature log. | **Passed** | `GET /api/v1/contracts/:id/pdf` streams PDFKit generated document with authorization verification. |
| **15. Real-Time Notifications** | Notify client of proposal responses, counteroffers, deliverable submissions, and amendment votes. | **Passed** | Notifications stream to client bell icon; supports mark-as-read and clear actions. |
| **16. Financial Telemetry Dashboard** | Display total contracted volume, approved disbursements, pipeline deliverables, and disputed holds. | **Passed** | Aggregates real database sums (`prisma.contract.aggregate` & `prisma.contractMilestone.aggregate`) for the client. |

---

## 3. SECURITY & TENANT ISOLATION AUDIT

### 3.1 IDOR & Authorization Controls
- **Contract Boundary:** In `contracts.controller.ts`, every contract query verifies `contract.clientId === currentClientProfile.id`. Any attempt by Client A to view or approve milestones in Client B's contract returns `404 Not Found` or `403 Forbidden`.
- **Hiring Request Boundary:** Clients can only inspect, withdraw, or convert proposals created by their own `clientProfileId`.
- **Milestone Approval RBAC:** Only the `CLIENT` party on the contract can execute `approveMilestone`. Workers or unauthorized third parties attempting this endpoint receive `403 Forbidden`.

### 3.2 Deliverable Storage Security
- Client download access to deliverable files stored in bucket `agreement-attachments` requires authorized signed URLs generated via `/api/v1/storage/signed-download-url`. Direct unauthenticated bucket access is denied by Supabase Storage policies.

---

## 4. CONCLUSION

The Client Portal meets all functional, architectural, and security requirements. All client workflows—from talent discovery and proposal negotiation through digital contract execution, deliverable review, milestone approval, and dispute resolution—operate reliably and securely.

