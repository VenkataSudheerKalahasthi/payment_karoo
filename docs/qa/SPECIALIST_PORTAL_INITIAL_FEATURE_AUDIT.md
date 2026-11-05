# TRUSTPAY ENTERPRISE v2.0
# SPECIALIST PORTAL — INITIAL FEATURE AUDIT REPORT

**Date:** November 5, 2026  
**Auditor:** Antigravity AI Engineering Pair Programmer  
**Target:** Specialist (Worker) Portal (`apps/web`, `apps/api`, `packages/shared`)  
**Database:** Supabase PostgreSQL with Prisma ORM  
**Security & Auth:** Clerk Authentication + RBAC (`UserRole.WORKER`)  

---

## 1. Feature Classification Matrix (21 Features)

| # | Feature Name | Classification | Current State & Root Cause Analysis | Relevant Files & Models |
|---|---|---|---|---|
| **1** | **Dashboard** | **B. PARTIALLY WORKING** | Backend `GET /dashboard` calculates worker metrics (`activeContracts`, `pendingMilestones`, `revisionRequests`, etc.). However, frontend `DashboardOverview.tsx` is predominantly styled for clients and lacks quick-actions, revision alerts, and direct milestone action links for specialists. | `apps/api/src/modules/dashboard/dashboard.controller.ts`<br>`apps/web/src/components/DashboardOverview.tsx` |
| **2** | **My Profile** | **B. PARTIALLY WORKING** | Backend `GET /workers/me` and `PUT /workers/me/profile` are functional. Frontend `ProfileManagement.tsx` supports bio, rate, and location, but lacks completion scoring, dedicated specialist navigation, and clear visual separation from general user settings. | `apps/api/src/modules/workers/workers.controller.ts`<br>`apps/web/src/components/ProfileManagement.tsx` |
| **3** | **Portfolio** | **B. PARTIALLY WORKING** | Backend supports CRUD via `POST/PUT/DELETE /workers/me/portfolio`. In the UI, portfolio management is buried at the bottom of the profile tab rather than having a dedicated showcase and editor view with file attachment links. | `apps/api/src/modules/workers/workers.routes.ts`<br>`apps/web/src/components/ProfileManagement.tsx` |
| **4** | **Skills & Expertise** | **B. PARTIALLY WORKING** | Backend `POST/DELETE /workers/me/skills` and `GET /skills` function properly. The frontend UI is restricted to a simple dropdown in the profile view without category search or level badges. | `apps/api/src/modules/skills/`<br>`apps/web/src/components/ProfileManagement.tsx` |
| **5** | **Browse Opportunities** | **E. NOT IMPLEMENTED** | There is currently **no public/specialist opportunity browsing feed** or project discovery marketplace where specialists can search, filter by skill/budget, view client project scopes, and submit proposals. | *Missing:* `apps/api/src/modules/projects/opportunities.controller.ts`<br>*Missing:* `apps/web/src/components/SpecialistOpportunities.tsx` |
| **6** | **Hiring Requests** | **A. FULLY WORKING** | Backend `GET /hiring-requests` and `PATCH /hiring-requests/:id/respond` allow specialists to accept, decline, or negotiate incoming requests. `HiringRequestsList.tsx` handles responses correctly. | `apps/api/src/modules/hiring-requests/`<br>`apps/web/src/components/HiringRequestsList.tsx` |
| **7** | **Proposals & Negotiation** | **B. PARTIALLY WORKING** | Negotiation on received hiring requests is supported via counteroffers. However, initiating project proposals from open opportunities is missing because the opportunity discovery engine is not yet connected. | `apps/api/src/modules/hiring-requests/`<br>`apps/web/src/components/HiringRequestsList.tsx` |
| **8** | **My Projects** | **A. FULLY WORKING** | `ProjectsWorkspace.tsx` connects to `GET /projects` and displays active projects, milestone checklist, progress percentage, client info, and milestone activities. | `apps/api/src/modules/projects/`<br>`apps/web/src/components/ProjectsWorkspace.tsx` |
| **9** | **Digital Contracts** | **A. FULLY WORKING** | `ContractList.tsx` and `ContractDetailModal.tsx` retrieve worker contracts via `GET /contracts`, display milestones, financial allocations, and allow downloading official contract PDFs. | `apps/api/src/modules/contracts/`<br>`apps/web/src/components/ContractList.tsx` |
| **10** | **Digital Signatures** | **A. FULLY WORKING** | `POST /contracts/:id/accept` records mutual acceptance with canonical SHA-256 cryptographic digests and IP audit trails. Specialists can sign pending contracts in `ContractLifecyclePanel.tsx`. | `apps/api/src/modules/contracts/contracts.controller.ts`<br>`apps/web/src/components/ContractLifecyclePanel.tsx` |
| **11** | **Earnings & Wallet** | **A. FULLY WORKING** | `SpecialistWallet.tsx` connects to `GET /payments/wallet` to display double-entry ledger-backed earnings, eligible settlement balances, pending amounts, and settlement transaction journals. Live movement is safely locked. | `apps/api/src/modules/payments/payments.controller.ts`<br>`apps/web/src/components/SpecialistWallet.tsx` |
| **12** | **Milestone Management** | **B. PARTIALLY WORKING** | Backend endpoints `PATCH /contracts/:id/milestones/:milestoneId/start` exist. `MilestoneManagement.tsx` was built with client approval focus; specialists need dedicated views to start milestones, track deadlines, and monitor review status. | `apps/api/src/modules/contracts/contracts.controller.ts`<br>`apps/web/src/components/MilestoneManagement.tsx` |
| **13** | **Deliverable Submission** | **B. PARTIALLY WORKING** | Backend `POST /contracts/:id/milestones/:milestoneId/submissions` is functional. In the UI, submission is only accessible inside `ProjectsWorkspace.tsx` or `ContractDetailModal.tsx`, not in the top-level `MilestoneManagement.tsx` view. | `apps/api/src/modules/contracts/contracts.controller.ts`<br>`apps/web/src/components/MilestoneManagement.tsx` |
| **14** | **Revision Management** | **B. PARTIALLY WORKING** | Revisions are tracked in `MilestoneActivity` and `milestone.status === 'IN_REVISION'`. The specialist needs clear visual prominence of client feedback and 1-click resubmission. | `apps/api/src/modules/contracts/`<br>`apps/web/src/components/MilestoneManagement.tsx` |
| **15** | **Payment History** | **A. FULLY WORKING** | `PaymentHistory.tsx` queries `GET /payments/transactions` (scoped to `payeeId === user.id`), displays formatted USD amounts from minor units, status badges, and transaction details. | `apps/api/src/modules/payments/`<br>`apps/web/src/components/PaymentHistory.tsx` |
| **16** | **Invoices** | **B. PARTIALLY WORKING** | Backend `GET /contracts/invoices/all` returns invoices for both clients and specialists. `ClientInvoices.tsx` is titled for clients and needs specialist perspective (invoices issued to clients). | `apps/api/src/modules/contracts/invoice.controller.ts`<br>`apps/web/src/components/ClientInvoices.tsx` |
| **17** | **Documents** | **A. FULLY WORKING** | `DocumentsVault.tsx` indexes executed contracts, deliverables, and invoices across all contracts with signed downloads. | `apps/web/src/components/DocumentsVault.tsx` |
| **18** | **Messages** | **A. FULLY WORKING** | `ClientMessages.tsx` provides real-time encrypted messaging between clients and specialists for active contracts with polling sync and participant identification. | `apps/api/src/modules/conversations/`<br>`apps/web/src/components/ClientMessages.tsx` |
| **19** | **Dispute Management** | **B. PARTIALLY WORKING** | `ClientDisputes.tsx` lists disputes and allows rebuttals and evidence uploads. Needs to support specialist rebuttal workflow explicitly when client files a claim. | `apps/api/src/modules/disputes/`<br>`apps/web/src/components/ClientDisputes.tsx` |
| **20** | **Notifications** | **A. FULLY WORKING** | `NotificationDropdown.tsx` connects to `GET /notifications` and receives real-time updates for contracts, milestones, hiring requests, and messages. | `apps/web/src/components/NotificationDropdown.tsx` |
| **21** | **Settings** | **A. FULLY WORKING** | Integrated with Clerk user profile management and user preference state in Redux. | `apps/web/src/App.tsx`<br>`@clerk/clerk-react` |

---

## 2. Gap Remediation Plan

To bring all 21 features to **A. FULLY WORKING**:

1. **Implement Feature 5: Browse Opportunities & Open Project Discovery**:
   - Backend: Add `GET /api/v1/projects/opportunities` in `apps/api/src/modules/projects/projects.routes.ts` returning active/open projects or contracts seeking specialists, with skill tags, budget, scope, and client info.
   - Frontend: Build `apps/web/src/components/SpecialistOpportunities.tsx` with search, skill filter, budget filter, deadline sorting, project detail view, and "Submit Proposal" modal.
2. **Upgrade Feature 1: Specialist Dashboard**:
   - Enhance `DashboardOverview.tsx` when `isWorker` is active:
     - Show Specialist KPI tiles (Active Contracts, Milestones in Progress, Deliverables to Submit, Revision Requests, Eligible Earnings, Settled Earnings).
     - Action buttons: "Browse Opportunities", "Incoming Proposals", "My Deliverables", "Specialist Wallet".
     - Highlight active revision requests with direct link to resubmit.
3. **Upgrade Features 12, 13, 14: Specialist Milestone Workflow in `MilestoneManagement.tsx`**:
   - Add role awareness (`userRole` prop):
     - For Specialist (`WORKER`):
       - If `PENDING`: show "Commence Work" button (calls `apiService.startMilestone`).
       - If `IN_PROGRESS` or `IN_REVISION`: show "Submit Deliverable" button with deliverable notes, file attachment URLs, and external links modal.
       - If `IN_REVISION`: display prominent amber warning with the client's revision comments and historical submission versions.
4. **Upgrade Features 3 & 4: Dedicated Portfolio & Skills Showcase in Sidebar**:
   - Add dedicated sidebar items for "My Portfolio" and "Skills & Expertise" (or modular tabs in `ProfileManagement.tsx`).
5. **Generalize Features 16 & 19 (Invoices & Disputes)**:
   - Make `ClientInvoices.tsx` and `ClientDisputes.tsx` adapt titles, labels, and actions dynamically based on `userRole` (e.g., "Invoices Issued to Clients" and "Specialist Rebuttal Center").
6. **Update Left Sidebar Navigation in `App.tsx`**:
   - Ensure specialists have tailored sidebar navigation:
     - `Dashboard`
     - `Browse Opportunities` (New!)
     - `Incoming Proposals`
     - `My Agreements`
     - `Milestones & Deliverables`
     - `Projects Workspace`
     - `Earnings & Wallet`
     - `Payment History`
     - `Invoices`
     - `Document Vault`
     - `Messages`
     - `Dispute Center`
     - `Profile, Skills & Portfolio`

