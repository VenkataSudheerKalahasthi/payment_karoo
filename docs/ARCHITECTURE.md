# TrustPay Enterprise v2.0 &mdash; System Architecture Document

## 1. Executive Summary

TrustPay Enterprise v2.0 is a secure digital contract and escrow management platform designed to facilitate trusted commercial agreements between Clients and specialized Workers. The architecture is engineered around high assurance, tamper-evident milestone validation, multi-signature contract workflows, and regulatory compliance.

Phase 1 establishes the production-grade foundation, development environment, and monorepo architecture across all client portals, administrative suites, central backend services, and database layers.

---

## 2. Monorepo Organization

The project employs an npm workspace-driven monorepo to maintain strict architectural boundaries while facilitating typed contracts across all tiers.

```
TrustPay-Enterprise/
├── apps/
│   ├── web/                 # Port 3000: Client & Worker Primary Portal
│   ├── admin/               # Port 3001: Operational & Dispute Mediation Portal
│   ├── superadmin/          # Port 3002: Platform Governance & Root Audit Portal
│   └── api/                 # Port 5000: Central Express.js Modular Backend
├── packages/
│   └── shared/              # Shared TypeScript data models, contracts & utilities
├── docs/
│   ├── ARCHITECTURE.md      # Platform & system design specification
│   ├── DATABASE.md          # PostgreSQL connection & ORM lifecycle specification
│   └── DEVELOPMENT.md       # Local setup, build, and contribution instructions
├── .env.example             # Monorepo environment configuration template
├── .gitignore               # Strict secret and build artifact exclusion
├── package.json             # Root workspace definitions & unified scripts
└── README.md                # System overview and quick-start guide
```

---

## 3. Architecture Pattern: Modular Monolith

TrustPay Enterprise v2.0 is purposefully architected as a **modular monolith** rather than distributed microservices:

1. **Transactional Integrity**: Financial escrow ledgers and milestone contract transitions require strict atomicity (`ACID`). A centralized transactional database prevents distributed transaction failures and eventual consistency anomalies.
2. **Simplified Operational Overhead**: A single, robustly monitored Express.js engine simplifies continuous integration, deployment, and audit trail collection.
3. **Internal Domain Boundaries**: The backend is divided into discrete internal domain modules (e.g., `health`, `contracts`, `escrow`, `disputes`), cleanly separating logic while sharing a unified runtime.

---

## 4. Frontend Application Boundaries

Three distinct client applications serve segregated operational roles:

| Application       | Port | User Audience                            | Primary Responsibilities                                                                     |
| ----------------- | ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/web`        | 3000 | Clients, Workers, Contractors            | Contract authoring, milestone submission, escrow funding view, delivery reviews.             |
| `apps/admin`      | 3001 | Compliance Officers, Dispute Arbitrators | Evidence examination, milestone dispute arbitration, user KYC auditing.                      |
| `apps/superadmin` | 3002 | Platform Owners, Security Officers       | Global configuration, emergency circuit breakers, fee policies, immutable system audit logs. |

All three frontend applications are built on **React 18 + Vite + TypeScript + Tailwind CSS** and interface with the same backend API (`/api/v1`).

---

## 5. Security & Authentication Architecture

### 5.1 Defense in Depth

- **Helmet Security Middleware**: Hardens HTTP response headers against clickjacking, MIME sniffing, and cross-site scripting.
- **Configurable Strict CORS**: Origins are strictly validated against an approved whitelist (`CLIENT_URL`, `ADMIN_URL`, `SUPERADMIN_URL`).
- **Rate Limiting**: IP-based rate limiting via `express-rate-limit` prevents brute-force attacks and resource exhaustion.
- **Zod Validation**: Strict environment variable parsing at server boot prevents startup under invalid configurations.
- **No Client Trust**: Client applications never supply authoritative role claims. All authorization checks are executed server-side.

### 5.2 Clerk Integration Plan

- Authentication is delegated to **Clerk** via official React (`@clerk/clerk-react`) and Backend (`@clerk/backend`) SDKs.
- Custom JWT or bcrypt authentication schemes are strictly prohibited.
- Role-based access control (RBAC) maps identities to system roles:
  - `CLIENT` / `WORKER` &rarr; `apps/web`
  - `ADMIN` &rarr; `apps/admin`
  - `SUPERADMIN` &rarr; `apps/superadmin`

---

## 6. Shared Package (`@trustpay/shared`)

The shared package provides single-source-of-truth TypeScript definitions across the backend and frontend applications:

- **`ApiResponse<T>`**: Standardized JSON envelope guaranteeing uniform response formatting.
- **`SystemHealthStatus` & `DatabaseHealthStatus`**: Structured telemetry models.
- **`UserRole`**: Immutable role enumeration constants (`CLIENT`, `WORKER`, `ADMIN`, `SUPERADMIN`).
