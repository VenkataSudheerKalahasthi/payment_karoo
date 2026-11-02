# TRUSTPAY ENTERPRISE v2.0 — PHASE 9
# ESCROW REAL-TIME FINANCIAL OVERSIGHT REPORT

**Module:** Real-Time Escrow & Financial Notification System  
**Phase:** Phase 9 — Production Security, Compliance & Operational Validation  
**Date:** 2026-11-02  
**Real-Time Status:** OPERATIONAL & AUTHORIZED  

---

## 1. Real-Time Architecture Overview

TrustPay Enterprise v2.0 utilizes Socket.IO for authorized, low-latency push notifications across all five workspaces. The real-time gateway is initialized in `apps/api/src/server.ts` and managed through `apps/api/src/modules/realtime/realtime.service.ts`.

### Security Invariants for Financial Events:
1. **Authenticated Connections**: Every socket handshake verifies the Clerk session token. Anonymous or invalid sockets are disconnected immediately.
2. **Room Authorization**: Financial notifications are emitted strictly to isolated rooms:
   - User Private Room: `user:${userId}` (for contract participants).
   - Contract Room: `contract:${contractId}` (accessible only to contract client, worker, and admins).
   - Governance Room: `admin:financial_oversight` (restricted to `ADMIN` and `SUPERADMIN`).
3. **Post-Commit Emission**: Socket events are fired **only after** database transactions have successfully committed to Supabase PostgreSQL. Uncommitted or rolled-back events are never broadcast.
4. **No Financial Movement via WebSocket**: WebSocket messages are strictly read-only push notifications. No socket event can initiate a fund transfer, release, or refund.

---

## 2. Supported Financial Real-Time Events

| Event Name | Target Room | Payload | Purpose |
| :--- | :--- | :--- | :--- |
| `escrow:initialized` | `contract:${contractId}` | Contract ID, status, total amount minor, currency | Notifies participants of escrow agreement creation |
| `escrow:state_changed` | `contract:${contractId}` | Operational state, previous state, timestamp | Real-time visual synchronization on portal dashboards |
| `escrow:dispute_hold` | `contract:${contractId}` | Hold status (`true`/`false`), reason, actor ID | Freezes milestone submission and release UI |
| `escrow:milestone_allocated` | `contract:${contractId}` | Milestone ID, allocated amount minor | Updates milestone allocation progress bar |
| `ledger:transaction_posted` | `admin:financial_oversight` | Reference, type, amount minor, currency | Real-time administrative compliance auditing |
| `ledger:alert_unbalanced` | `admin:financial_oversight` | Attempted reference, discrepancy minor | Urgent platform security alert for attempted tampering |

---

## 3. Frontend Real-Time Consumers

- **Client Portal (`apps/web`)**:
  - Subscribes to `contract:${contractId}` events when viewing contract detail modals.
  - Updates `ThreeEscrowVisual` dynamically when `escrow:state_changed` arrives.
- **Worker Portal (`apps/web`)**:
  - Subscribes to contract milestones and dispute alerts.
- **Admin & Superadmin Portals (`apps/admin`, `apps/superadmin`)**:
  - Subscribes to `admin:financial_oversight`.
  - Dynamically updates trial balance charts and transaction tables in `AdminFinancialOversight.tsx`.

---

## 4. Reconnection & Resilience
- Socket.IO clients automatically reconnect with exponential backoff.
- The UI triggers REST profile and contract refreshes on reconnection, ensuring zero stale financial metrics even after network interruptions.

