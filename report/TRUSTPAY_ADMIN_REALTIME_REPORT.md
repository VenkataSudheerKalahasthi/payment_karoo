# TRUSTPAY ENTERPRISE v2.0
# ADMIN PORTAL — REAL-TIME ARCHITECTURE & WEBSOCKET AUDIT REPORT

**Project:** TrustPay Enterprise v2.0  
**Workspace:** `D:\Payment_mama`  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Module:** Admin Portal Real-time Integration & Event Delivery  
**Phase:** Phase 9 — Production Security, Compliance & Operational Validation  
**Date:** November 2026  
**Auditor:** Principal Full-Stack Engineer & Real-Time Systems Architect  

---

## 1. Executive Summary

This report documents the Socket.IO real-time event distribution architecture for the Admin Portal (`apps/admin`). Administrative users automatically receive real-time telemetry, contract state updates, milestone submissions, and dispute event notifications without manual page polling.

---

## 2. Real-Time Architecture & Channel Design

### 2.1 Authenticated Connection Handshake
- When an administrative user signs in with Clerk, `apps/admin/src/services/socket.ts` initializes a WebSocket connection to the Express API.
- The connection passes the Clerk session token in `auth.token`.
- The server validates the token in `apps/api/src/modules/realtime/socket.service.ts`:
  - Decodes and verifies the Clerk JWT.
  - Queries Prisma to identify the user and confirm their role (`ADMIN` or `SUPERADMIN`).
  - Stores authenticated user claims on `socket.data.user`.

### 2.2 Automatic Administrative Channel Subscription
Unlike standard clients or workers who only join rooms for their own contracts, administrative connections are automatically enrolled in platform-wide governance channels upon successful handshake:
- `admin:contracts`: Telemetry channel receiving all contract creations, status transitions, version increments, and amendments.
- `admin:dashboard`: Telemetry channel receiving user status changes, new dispute filings, and escrow hold toggles.

```typescript
// apps/api/src/modules/realtime/socket.service.ts
if (user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN)) {
  socket.join('admin:contracts');
  socket.join('admin:dashboard');
  logger.info(`[Socket.IO] Admin ${user.email} joined administrative channels`);
}
```

### 2.3 Event Emission Mapping

| Event Name | Source Action | Broadcast Targets | Payload Details |
| :--- | :--- | :--- | :--- |
| `contract:event` | Contract created / status changed | `contract:<id>`, `admin:contracts` | Event ID, timestamp, contract ID, version, new state |
| `milestone:event` | Deliverable submitted / approved | `contract:<id>`, `project:<id>`, `admin:contracts` | Milestone ID, status, submission metadata |
| `dispute:event` | Dispute opened / resolved | `contract:<id>`, `admin:contracts`, `admin:dashboard` | Dispute ID, dispute number, status, rationale |
| `user:status_changed` | User suspended / reactivated | `admin:dashboard` | User ID, previous status, new status, reason |

---

## 3. Client-Side Lifecycle & Subscription Management

In `apps/admin/src/App.tsx`, real-time lifecycle hooks manage active subscriptions:
```typescript
useEffect(() => {
  if (!isSignedIn) return;

  let active = true;
  getToken().then((token) => {
    if (!active || !token) return;
    const sock = initAdminSocket(token);

    const handleRefresh = () => {
      loadAdminData();
      if (activeTab === 'financial') loadFinancialData();
    };

    sock.on('contract:event', handleRefresh);
    sock.on('milestone:event', handleRefresh);
    sock.on('dispute:event', handleRefresh);
    sock.on('user:status_changed', handleRefresh);
  });

  return () => {
    active = false;
    disconnectAdminSocket();
  };
}, [isSignedIn, getToken, loadAdminData, loadFinancialData, activeTab]);
```

---

## 4. Security & Isolation Controls

1. **Unauthenticated Connection Rejection:** Sockets without valid Clerk tokens are immediately terminated with `AUTHENTICATION_REQUIRED`.
2. **Role Verification:** Standard users (`CLIENT`, `WORKER`) are barred from joining `admin:contracts` or `admin:dashboard`.
3. **Graceful Degradation:** If WebSocket connectivity is interrupted, the client falls back to long-polling and automatically re-authenticates upon reconnection.

---

## 5. Conclusion

The real-time architecture delivers high-fidelity, immediate operational observability to platform administrators while preserving strict multi-tenant channel isolation.

