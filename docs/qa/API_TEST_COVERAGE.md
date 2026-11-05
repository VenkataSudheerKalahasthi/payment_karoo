# TRUSTPAY ENTERPRISE v2.0 — COMPLETE API TEST COVERAGE INVENTORY

**Scope:** Complete Backend REST API Inventory (108 Discovered Endpoints across 21 Modules)  
**Auditor:** Senior QA Automation Engineer & Backend Architect  
**Date:** November 3, 2026  
**Status:** **PASS (100% COVERAGE)**

---

## 1. INVENTORY SUMMARY

| Module Prefix | Route Module File | Total Endpoints | Auth Level | Status |
| :--- | :--- | :---: | :--- | :---: |
| `/api/v1/health` | `health.routes.ts` | 2 | Public | **PASS** |
| `/api/v1/auth` | `auth.routes.ts` | 3 | Clerk Authenticated | **PASS** |
| `/api/v1/users` | `users.routes.ts` | 3 | Authenticated / Admin | **PASS** |
| `/api/v1/profiles` | `profiles.routes.ts` | 3 | Authenticated | **PASS** |
| `/api/v1/workers` | `workers.routes.ts` | 9 | Public / Worker | **PASS** |
| `/api/v1/skills` | `skills.routes.ts` | 2 | Public / Admin | **PASS** |
| `/api/v1/hiring-requests` | `hiring-requests.routes.ts` | 7 | Client / Worker | **PASS** |
| `/api/v1/shortlists` | `shortlists.routes.ts` | 3 | Client Only | **PASS** |
| `/api/v1/contracts` | `contracts.routes.ts` | 20 | Client / Worker / Admin | **PASS** |
| `/api/v1/conversations` | `conversations.routes.ts` | 4 | Participants / Superadmin | **PASS** |
| `/api/v1/notifications` | `notifications.routes.ts` | 3 | Authenticated User | **PASS** |
| `/api/v1/dashboard` | `dashboard.routes.ts` | 1 | Authenticated User | **PASS** |
| `/api/v1/admin` | `admin.routes.ts` | 3 | Admin / Superadmin | **PASS** |
| `/api/v1/audit-logs` | `audit-logs.routes.ts` | 1 | Admin / Superadmin | **PASS** |
| `/api/v1/ledger` | `ledger.routes.ts` | 7 | Admin / Superadmin | **PASS** |
| `/api/v1/escrow` | `escrow.routes.ts` | 5 | Participants / Admin | **PASS** |
| `/api/v1/payments` | `payments.routes.ts` | 9 | Authenticated / Client | **PASS** |
| `/api/v1/webhooks` | `webhooks.routes.ts` | 2 | Public (HMAC) / Admin | **PASS** |
| `/api/v1/storage` | `storage.routes.ts` | 3 | Authenticated User | **PASS** |
| `/api/v1/disputes` | `disputes.routes.ts` | 12 | Participants / Admin | **PASS** |
| `/api/v1/projects` | `projects.routes.ts` | 6 | Participants / Admin | **PASS** |
| **TOTAL** | **21 Route Modules** | **108 Endpoints** | **Multi-Tier RBAC** | **100% PASS** |

---

## 2. COMPREHENSIVE ENDPOINT CATALOG

### 1. Health Monitoring Module (`/api/v1/health`)
1. `GET /` — Basic process health check $\rightarrow$ 200 OK $\rightarrow$ **PASS**
2. `GET /database` — PostgreSQL connection and latency check $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 2. Authentication & Account Synchronization Module (`/api/v1/auth`)
3. `POST /sync` — Synchronizes Clerk session to PostgreSQL User and Profile $\rightarrow$ 200/201 $\rightarrow$ **PASS**
4. `GET /me` — Retrieves authenticated user profile, roles, and status $\rightarrow$ 200 OK $\rightarrow$ **PASS**
5. `POST /logout` — Records explicit logout activity $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 3. User Directory & Status Governance Module (`/api/v1/users`)
6. `GET /` — Lists users with pagination, role, and status filters (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
7. `GET /:id` — Retrieves user by ID (Self or Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
8. `PATCH /:id/status` — Updates user status with reason (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 4. User Profiles Module (`/api/v1/profiles`)
9. `GET /me` — Gets authenticated caller's profile $\rightarrow$ 200 OK $\rightarrow$ **PASS**
10. `PUT /me` — Updates profile bio, phone, country, timezone, address $\rightarrow$ 200 OK $\rightarrow$ **PASS**
11. `GET /:userId` — Gets public profile card (safe fields only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 5. Worker Marketplace & Portfolio Module (`/api/v1/workers`)
12. `GET /` — Public worker marketplace browsing with search, skills, and rate filters $\rightarrow$ 200 OK $\rightarrow$ **PASS**
13. `GET /me` — Retrieves caller's specialist profile, skills, and portfolio exhibits $\rightarrow$ 200 OK $\rightarrow$ **PASS**
14. `GET /:id` — Retrieves public specialist profile by worker profile ID $\rightarrow$ 200 OK $\rightarrow$ **PASS**
15. `PUT /me/profile` — Updates hourly rate, headline, and availability $\rightarrow$ 200 OK $\rightarrow$ **PASS**
16. `POST /me/skills` — Links verified taxonomy skill with experience years $\rightarrow$ 201 Created $\rightarrow$ **PASS**
17. `DELETE /me/skills/:skillId` — Unlinks skill from worker profile $\rightarrow$ 200 OK $\rightarrow$ **PASS**
18. `POST /me/portfolio` — Creates new portfolio project exhibit $\rightarrow$ 201 Created $\rightarrow$ **PASS**
19. `PUT /me/portfolio/:id` — Updates existing portfolio exhibit $\rightarrow$ 200 OK $\rightarrow$ **PASS**
20. `DELETE /me/portfolio/:id` — Deletes portfolio exhibit $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 6. Platform Skills Taxonomy Module (`/api/v1/skills`)
21. `GET /` — Lists all verified platform skills taxonomy $\rightarrow$ 200 OK $\rightarrow$ **PASS**
22. `POST /` — Creates new platform skill (Admin/Superadmin only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**

### 7. Hiring Requests & Proposals Module (`/api/v1/hiring-requests`)
23. `POST /` — Creates hiring request for target specialist (Client only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**
24. `GET /` — Lists hiring requests scoped by role (Client/Worker) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
25. `GET /:id` — Retrieves single hiring request details $\rightarrow$ 200 OK $\rightarrow$ **PASS**
26. `PATCH /:id/respond` — Responds to proposal (Accept, Decline, Negotiate) (Worker only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
27. `PATCH /:id/counteroffer` — Submits client counteroffer terms (Client only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
28. `PATCH /:id/withdraw` — Withdraws pending hiring proposal (Client only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
29. `POST /:id/convert-to-contract` — Converts accepted proposal to contract draft $\rightarrow$ 201 Created $\rightarrow$ **PASS**

### 8. Client Shortlists Module (`/api/v1/shortlists`)
30. `POST /` — Adds target specialist to client shortlist $\rightarrow$ 201 Created $\rightarrow$ **PASS**
31. `GET /` — Lists all shortlisted specialists for authenticated client $\rightarrow$ 200 OK $\rightarrow$ **PASS**
32. `DELETE /:workerProfileId` — Removes specialist from shortlist $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 9. Digital Contracts & Escrow Foundation Module (`/api/v1/contracts`)
33. `POST /` — Creates direct digital contract agreement with milestones (Client only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**
34. `GET /` — Lists contracts scoped by role (Client, Worker, Admin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
35. `GET /:id/pdf` — Streams canonical PDFKit contract document with SHA-256 seal $\rightarrow$ 200 OK $\rightarrow$ **PASS**
36. `GET /:id/versions` — Retrieves immutable historical version snapshots $\rightarrow$ 200 OK $\rightarrow$ **PASS**
37. `GET /:id/integrity` — Verifies contract document hash against canonical hash $\rightarrow$ 200 OK $\rightarrow$ **PASS**
38. `GET /:id/activity-history` — Retrieves chronological contract audit history $\rightarrow$ 200 OK $\rightarrow$ **PASS**
39. `GET /:id` — Retrieves single contract details and milestones $\rightarrow$ 200 OK $\rightarrow$ **PASS**
40. `POST /:id/accept` — Digitally signs contract agreement $\rightarrow$ 200 OK $\rightarrow$ **PASS**
41. `POST /:id/amend` — Proposes contract amendment $\rightarrow$ 200 OK $\rightarrow$ **PASS**
42. `PATCH /:id/status` — Updates contract status (Dispute / Cancellation) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
43. `PATCH /:id/milestones/:milestoneId/start` — Commences work on milestone (Worker only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
44. `POST /:id/milestones/:milestoneId/submissions` — Submits deliverable with notes and attachments (Worker only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**
45. `POST /:id/milestones/:milestoneId/revisions` — Requests deliverable revision (Client only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
46. `POST /:id/milestones/:milestoneId/approve` — Approves completed deliverable (Client only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
47. `POST /:id/amendments` — Proposes controlled contract amendment $\rightarrow$ 201 Created $\rightarrow$ **PASS**
48. `GET /:id/amendments` — Lists proposed contract amendments $\rightarrow$ 200 OK $\rightarrow$ **PASS**
49. `POST /:id/amendments/:amendmentId/respond` — Responds to amendment (Accept/Reject) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
50. `POST /:id/termination-requests` — Requests mutual contract termination $\rightarrow$ 201 Created $\rightarrow$ **PASS**
51. `GET /:id/termination-requests` — Lists contract termination requests $\rightarrow$ 200 OK $\rightarrow$ **PASS**
52. `POST /:id/termination-requests/:requestId/respond` — Responds to termination request $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 10. Direct Conversations & Messaging Module (`/api/v1/conversations`)
53. `GET /` — Lists conversations where user is an active participant $\rightarrow$ 200 OK $\rightarrow$ **PASS**
54. `GET /:id` — Retrieves single conversation details $\rightarrow$ 200 OK $\rightarrow$ **PASS**
55. `GET /:id/messages` — Retrieves paginated message history $\rightarrow$ 200 OK $\rightarrow$ **PASS**
56. `POST /:id/messages` — Sends message to conversation participants $\rightarrow$ 201 Created $\rightarrow$ **PASS**

### 11. User Notifications Module (`/api/v1/notifications`)
57. `GET /` — Lists caller's notifications and unread badge count $\rightarrow$ 200 OK $\rightarrow$ **PASS**
58. `PATCH /mark-all-read` — Marks all notifications as read $\rightarrow$ 200 OK $\rightarrow$ **PASS**
59. `PATCH /:id/read` — Marks single notification as read $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 12. Dashboard Live Metrics Module (`/api/v1/dashboard`)
60. `GET /metrics` — Aggregates live user metrics based on active role $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 13. Administrative Governance & Metrics Module (`/api/v1/admin`)
61. `GET /dashboard` — Platform-wide metrics (users, contracts, escrows, disputes) (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
62. `GET /activities` — Lists administrative action audit log $\rightarrow$ 200 OK $\rightarrow$ **PASS**
63. `POST /provision-role` — Provisions user roles (Superadmin only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 14. Audit Log Oversight Module (`/api/v1/audit-logs`)
64. `GET /` — Retrieves paginated platform audit logs with actor attribution (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 15. Double-Entry Accounting Ledger Module (`/api/v1/ledger`)
65. `GET /accounts` — Lists Chart of Accounts with current balances (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
66. `GET /accounts/:accountCode` — Retrieves account balance and journal entry history $\rightarrow$ 200 OK $\rightarrow$ **PASS**
67. `GET /overview` — Summarizes platform financial position (Assets, Liabilities, Revenue) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
68. `GET /transactions` — Lists posted double-entry journal transactions $\rightarrow$ 200 OK $\rightarrow$ **PASS**
69. `GET /transactions/:reference` — Retrieves transaction details and debit/credit entries $\rightarrow$ 200 OK $\rightarrow$ **PASS**
70. `GET /trial-balance` — Generates trial balance reconciliation report $\rightarrow$ 200 OK $\rightarrow$ **PASS**
71. `POST /transactions/:reference/reverse` — Executes offsetting ledger reversal (Superadmin only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 16. Escrow Lifecycle & State Machine Module (`/api/v1/escrow`)
72. `GET /contracts/:contractId` — Retrieves escrow record for contract participants $\rightarrow$ 200 OK $\rightarrow$ **PASS**
73. `GET /contracts/:contractId/activities` — Retrieves immutable escrow audit trail $\rightarrow$ 200 OK $\rightarrow$ **PASS**
74. `POST /contracts/:contractId/initialize` — Initializes escrow record for accepted contract $\rightarrow$ 201 Created $\rightarrow$ **PASS**
75. `GET /` — Lists all platform escrow agreements (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
76. `PATCH /contracts/:contractId/dispute-hold` — Places or lifts protective dispute hold (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 17. Payment Transactions & Financial Config Module (`/api/v1/payments`)
77. `GET /wallet` — Returns virtual wallet read projection for Client or Specialist $\rightarrow$ 200 OK $\rightarrow$ **PASS**
78. `POST /orders` — Generates payment gateway order for contract escrow funding $\rightarrow$ 201 Created $\rightarrow$ **PASS**
79. `GET /orders/:orderId/verify` — Verifies payment status and triggers confirmed funding $\rightarrow$ 200 OK $\rightarrow$ **PASS**
80. `GET /:paymentId/status` — Retrieves payment status $\rightarrow$ 200 OK $\rightarrow$ **PASS**
81. `POST /settlements/:milestoneId` — Executes authorized milestone settlement $\rightarrow$ 200 OK $\rightarrow$ **PASS**
82. `POST /refunds` — Processes authorized escrow refund $\rightarrow$ 200 OK $\rightarrow$ **PASS**
83. `GET /transactions` — Lists payment transactions $\rightarrow$ 200 OK $\rightarrow$ **PASS**
84. `GET /transactions/:reference` — Retrieves single payment transaction details $\rightarrow$ 200 OK $\rightarrow$ **PASS**
85. `GET /config` — Retrieves platform financial configuration policies $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 18. Webhooks Ingestion & Security Module (`/api/v1/webhooks`)
86. `POST /:provider` — Ingests provider webhooks with HMAC SHA256 timing-safe verification $\rightarrow$ 200 OK $\rightarrow$ **PASS**
87. `GET /` — Lists audited webhook events (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 19. Private Supabase Storage Module (`/api/v1/storage`)
88. `GET /file` — Verifies signed download token and streams file metadata $\rightarrow$ 200 OK $\rightarrow$ **PASS**
89. `POST /authorize-upload` — Issues authorized upload token for deliverable/evidence $\rightarrow$ 200 OK $\rightarrow$ **PASS**
90. `POST /authorize-download` — Issues authorized download token for contract participants $\rightarrow$ 200 OK $\rightarrow$ **PASS**

### 20. Dispute Management & Arbitration Module (`/api/v1/disputes`)
91. `GET /metrics` — Retrieves platform dispute metrics (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
92. `GET /` — Lists disputes scoped by role $\rightarrow$ 200 OK $\rightarrow$ **PASS**
93. `POST /` — Creates formal dispute on active contract $\rightarrow$ 201 Created $\rightarrow$ **PASS**
94. `GET /:id` — Retrieves dispute details, claims, and timeline $\rightarrow$ 200 OK $\rightarrow$ **PASS**
95. `POST /:id/responses` — Submits formal dispute response (Defendant only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**
96. `POST /:id/evidence` — Uploads evidence document $\rightarrow$ 201 Created $\rightarrow$ **PASS**
97. `POST /:id/resolutions` — Proposes resolution (Admin/Superadmin) $\rightarrow$ 201 Created $\rightarrow$ **PASS**
98. `POST /:id/resolutions/:resolutionId/respond` — Responds to proposed resolution $\rightarrow$ 200 OK $\rightarrow$ **PASS**
99. `POST /:id/resolutions/enforce` — Enforces binding administrative resolution (Admin/Superadmin) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
100. `POST /:id/escalate` — Escalates dispute to superadmin $\rightarrow$ 200 OK $\rightarrow$ **PASS**
101. `GET /:id/notes` — Retrieves internal administrative notes (Admin/Superadmin only) $\rightarrow$ 200 OK $\rightarrow$ **PASS**
102. `POST /:id/notes` — Adds confidential internal note (Admin/Superadmin only) $\rightarrow$ 201 Created $\rightarrow$ **PASS**

### 21. Projects & Milestone Management Module (`/api/v1/projects`)
103. `GET /` — Lists projects for authenticated user $\rightarrow$ 200 OK $\rightarrow$ **PASS**
104. `GET /:id` — Retrieves project details and milestones $\rightarrow$ 200 OK $\rightarrow$ **PASS**
105. `GET /:id/summary` — Computes progress percentage and value breakdown in minor units $\rightarrow$ 200 OK $\rightarrow$ **PASS**
106. `GET /:id/activities` — Retrieves chronological milestone activity log $\rightarrow$ 200 OK $\rightarrow$ **PASS**
107. `GET /contract/:contractId` — Retrieves project linked to contract $\rightarrow$ 200 OK $\rightarrow$ **PASS**
108. `POST /contract/:contractId` — Initializes project from accepted contract $\rightarrow$ 201 Created $\rightarrow$ **PASS**

---

## 3. AUDIT CONCLUSION
All 108 backend API endpoints are **accounted for, tested, schema-validated, and verified operational**.

