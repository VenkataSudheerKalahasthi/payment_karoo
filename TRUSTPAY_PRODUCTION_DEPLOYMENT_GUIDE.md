# TRUSTPAY ENTERPRISE v2.0 — PRODUCTION DEPLOYMENT GUIDE
## Step-by-Step Production Hosting & Environment Configuration

**Date:** November 1, 2026  
**Project:** TrustPay Enterprise v2.0  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Workspace:** `D:\Payment_mama`  
**Author:** Principal DevOps Architect & Senior Full-Stack Engineer  

---

## 1. Architecture Overview & Public Domain Mapping

TrustPay Enterprise v2.0 operates as a **single backend, three-portal, multi-tenant digital contract and escrow management system**:

```
                       ┌─────────────────────────┐
                       │     DNS / SSL Layer     │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
 ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
 │   apps/web        │    │   apps/admin      │    │  apps/superadmin  │
 │ (Client & Worker) │    │  (Admin Oversight)│    │(Governance Portal)│
 │ app.yourdomain.com│    │admin.yourdomain.com│   │superadmin.yourdom │
 └─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    │ HTTPS API Calls (Bearer JWT)
                                    ▼
                       ┌─────────────────────────┐
                       │        apps/api         │
                       │   api.yourdomain.com    │
                       └────────────┬────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      ▼                           ▼
            ┌───────────────────┐       ┌───────────────────┐
            │ Supabase Database │       │    Clerk Auth     │
            │   (PostgreSQL)    │       │(Production Cloud) │
            └───────────────────┘       └───────────────────┘
```

> [!IMPORTANT]
> **Business Rule**: The Cashfree Payment Gateway is **DEFERRED** in Phase 8. No real money movements, payouts, or live escrow settlements can occur.

---

## 2. Environment Variables Configuration

### A. Central Backend (`apps/api`) Environment Variables

Configure these variables in your backend hosting dashboard (e.g., Render / Railway):

| Variable Name | Required | Example Production Value | Purpose / Notes |
| :--- | :--- | :--- | :--- |
| **`NODE_ENV`** | **Yes** | `production` | Enables production optimizations & security policies |
| **`PORT`** | Automatically set | Provided by host (e.g. `10000`) | Standard cloud port injection |
| **`DATABASE_URL`** | **Yes** | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require` | Pooled connection string to Supabase |
| **`DIRECT_URL`** | Optional | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require` | Direct connection for Prisma migrations |
| **`CLIENT_URL`** | **Yes** | `https://app.yourdomain.com` | Public Client & Worker Portal URL |
| **`ADMIN_URL`** | **Yes** | `https://admin.yourdomain.com` | Public Admin Portal URL |
| **`SUPERADMIN_URL`** | **Yes** | `https://superadmin.yourdomain.com`| Public Superadmin Governance Portal URL |
| **`CORS_ORIGINS`** | **Yes** | `https://app.yourdomain.com,https://admin.yourdomain.com,https://superadmin.yourdomain.com` | Comma-separated authorized frontend origins |
| **`CLERK_SECRET_KEY`** | **Yes** | `sk_live_...` | Production Clerk backend API secret key |
| **`CLERK_PUBLISHABLE_KEY`** | **Yes** | `pk_live_...` | Production Clerk publishable key |
| **`STORAGE_SIGNING_SECRET`**| Optional | `your_64_char_random_hex_secret` | Used for HMAC signed download/upload URLs |
| **`PAYMENTS_LIVE_ENABLED`** | **Yes** | `false` | **MANDATORY**: Live money movement disabled |
| **`ESCROW_LIVE_MOVEMENT_ENABLED`**| **Yes** | `false` | **MANDATORY**: Live escrow transfers disabled |
| **`PAYOUTS_ENABLED`** | **Yes** | `false` | **MANDATORY**: Live payouts disabled |
| **`CASHFREE_ENV`** | **Yes** | `SANDBOX` | **DEFERRED**: Kept in Sandbox mode |

---

### B. Frontend Environment Variables

Configure these in your frontend hosting dashboard (e.g., Vercel / Netlify):

#### 1. Client & Worker Portal (`apps/web`)
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_production_publishable_key
```

#### 2. Admin Portal (`apps/admin`)
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_production_publishable_key
```

#### 3. Superadmin Portal (`apps/superadmin`)
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_production_publishable_key
```

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Deploy Central Backend (`apps/api`) on Render (or Railway)

1. **Create Web Service**:
   - Link your GitHub repository: `https://github.com/VenkataSudheerKalahasthi/payment_karoo`.
   - Name: `trustpay-api`.
   - Region: Select region closest to your Supabase instance (e.g., Frankfurt/Stockholm `eu-north-1`).
2. **Build & Start Commands**:
   - **Root Directory**: Leave blank (monorepo root) or set to repository root.
   - **Build Command**:
     ```bash
     npm run build:shared && npm run build:api
     ```
   - **Start Command**:
     ```bash
     npm run start:api
     ```
3. **Environment Variables**:
   - Add all variables listed in Section 2A.
4. **Health Check Path**:
   - Configure health check path to `/api/v1/health`.
5. **Deploy & Verify**:
   - Once deployed, visit `https://api.yourdomain.com/api/v1/health` and verify HTTP 200:
     ```json
     { "success": true, "data": { "status": "healthy", "service": "TrustPay Enterprise API" } }
     ```
   - Check database connectivity at `https://api.yourdomain.com/api/v1/health/database`.

---

### Step 2: Deploy Frontend Portals on Vercel

Repeat the following for each frontend application:

#### A. Client & Specialist Portal (`apps/web`)
1. In Vercel, click **Add New Project** and import the repository.
2. In Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build` (or `tsc && vite build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. Environment Variables:
   - `VITE_API_URL` = `https://api.yourdomain.com/api/v1`
   - `VITE_CLERK_PUBLISHABLE_KEY` = `pk_live_...`
4. Deploy and assign domain `app.yourdomain.com`.

#### B. Admin Portal (`apps/admin`)
1. Create new Vercel Project with Root Directory: `apps/admin`.
2. Configure environment variables (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`).
3. Deploy and assign domain `admin.yourdomain.com`.

#### C. Superadmin Portal (`apps/superadmin`)
1. Create new Vercel Project with Root Directory: `apps/superadmin`.
2. Configure environment variables (`VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`).
3. Deploy and assign domain `superadmin.yourdomain.com`.

> [!NOTE]
> All three frontends include [`vercel.json`](file:///d:/Payment_mama/apps/web/vercel.json) and [`_redirects`](file:///d:/Payment_mama/apps/web/public/_redirects) for SPA routing. Refreshing nested URLs will not cause 404 errors.

---

## 4. Clerk Production Authentication Setup

In the [Clerk Dashboard](https://dashboard.clerk.com):
1. **Switch to Production Instance** (or create a new Production application).
2. **Authorized Domains & Redirects**:
   - Add your production domains:
     - `https://app.yourdomain.com`
     - `https://admin.yourdomain.com`
     - `https://superadmin.yourdomain.com`
     - `https://api.yourdomain.com`
3. **Session Lifetime & JWT**:
   - Standard session tokens (valid for 60s, automatically refreshed by `@clerk/clerk-react`).
4. **Admin & Superadmin Provisioning**:
   - Register the primary administrator email account.
   - Using the Supabase SQL editor or backend administrative script, assign the user's role to `ADMIN` or `SUPERADMIN`.
   - Normal self-service sign-up default role is strictly `CLIENT` or `WORKER`.

---

## 5. Supabase Production Database & Storage Configuration

1. **Connection Pooling**:
   - The platform is pre-configured to use the Supabase session pooler on port 5432 with SSL enabled (`rejectUnauthorized: false`).
2. **Database Backups**:
   - Supabase automatically performs daily database backups.
   - For point-in-time recovery (PITR), enable PITR in the Supabase Dashboard under **Project Settings > Backups**.
3. **Private File Storage**:
   - Deliverables and evidence files are stored in private Supabase buckets.
   - Files are accessed only via backend-generated HMAC signed tokens expiring in 15 minutes. Public bucket listing is disabled.

---

## 6. Operational Monitoring & Health Verification

| Endpoint | Target Method | Expected Response | Alert Condition |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | `GET` | HTTP 200 `{ "status": "healthy" }` | Non-200 or timeout > 5s |
| `/api/v1/health/database`| `GET` | HTTP 200 `{ "status": "connected" }` | HTTP 503 `{ "status": "disconnected" }` |

Set up uptime monitoring (e.g., Better Uptime, UptimeRobot, or Render Health Checks) targeting `https://api.yourdomain.com/api/v1/health` on a 60-second interval.

