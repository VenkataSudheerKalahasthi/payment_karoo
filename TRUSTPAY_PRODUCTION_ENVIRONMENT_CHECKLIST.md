# TRUSTPAY ENTERPRISE v2.0 — PRODUCTION ENVIRONMENT CHECKLIST
## Comprehensive Variable Matrix for Render & Vercel Deployments

**Project:** TrustPay Enterprise v2.0  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Workspace:** `D:\Payment_mama`  
**Deployment Stack:** Render (Backend API) + Vercel (Web, Admin, Superadmin Frontends) + Supabase (Database/Storage)

---

> [!IMPORTANT]
> **SECURITY MANDATE**: Never commit secrets to GitHub and never paste secrets into public chats. Enter these values directly into your **Render** and **Vercel** provider dashboards.

---

## 1. Central Express API — Render Dashboard Variables

Configure these in your **Render Service Settings > Environment Variables**:

| Variable Name | Required | Recommended Production Value | Description & Source |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production caching, helmet CSP, and strict security validation. |
| `API_HOST` | **Yes** | `0.0.0.0` | Binds to all network interfaces for container port routing. |
| `PORT` | Auto | *(Injected automatically by Render)* | Render dynamically sets this (typically port `10000`). |
| `DATABASE_URL` | **Yes** | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require` | Pooled connection string to Supabase PostgreSQL (available in your local [`.env`](file:///d:/Payment_mama/.env#L7)). |
| `DIRECT_URL` | Optional | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require` | Direct connection for Prisma schema operations. |
| `CLIENT_URL` | **Yes** | `https://your-web-app.vercel.app` (or custom domain) | Public URL of the Client & Specialist Portal. |
| `ADMIN_URL` | **Yes** | `https://your-admin-app.vercel.app` (or custom domain) | Public URL of the Admin Portal. |
| `SUPERADMIN_URL` | **Yes** | `https://your-superadmin-app.vercel.app` (or custom domain) | Public URL of the Superadmin Governance Portal. |
| `CORS_ALLOWED_ORIGINS` | **Yes** | `https://your-web-app.vercel.app,https://your-admin-app.vercel.app,https://your-superadmin-app.vercel.app` | Comma-separated list of approved frontend origins. |
| `CLERK_SECRET_KEY` | **Yes** | `sk_live_...` (or `sk_test_...` for staging) | Clerk backend secret key from [dashboard.clerk.com > API Keys](https://dashboard.clerk.com/last-active?path=api-keys). |
| `CLERK_PUBLISHABLE_KEY`| **Yes** | `pk_live_...` (or `pk_test_...` for staging) | Clerk publishable key from Clerk dashboard. |
| `STORAGE_SIGNING_SECRET`| **Yes** | *(Generate a 64-character random hex string)* | Secret key used to sign private evidence download/upload URLs. |
| `SUPABASE_URL` | Optional | `https://[PROJECT_REF].supabase.co` | Supabase project URL for storage buckets. |
| `SUPABASE_SERVICE_ROLE_KEY`| Optional | `eyJhbGciOi...` | Supabase service role secret (backend-only, never expose). |
| `PAYMENTS_LIVE_ENABLED` | **Yes** | `false` | **MANDATORY**: Live money movement disabled. |
| `ESCROW_LIVE_MOVEMENT_ENABLED`| **Yes** | `false` | **MANDATORY**: Live escrow transfers disabled. |
| `PAYOUTS_ENABLED` | **Yes** | `false` | **MANDATORY**: Outbound payouts disabled. |
| `CASHFREE_ENV` | **Yes** | `SANDBOX` | **DEFERRED**: Kept in sandbox mode. |

---

## 2. Client & Worker Portal (`apps/web`) — Vercel Dashboard Variables

Configure these in the **Vercel Project Settings > Environment Variables** for `apps/web`:

| Variable Name | Required | Example Production Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://trustpay-api.onrender.com/api/v1` | Public HTTPS URL of the deployed Render backend API. |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | `pk_live_...` (or `pk_test_...`) | Clerk Publishable Key matching your Clerk instance. |

---

## 3. Admin Portal (`apps/admin`) — Vercel Dashboard Variables

Configure these in the **Vercel Project Settings > Environment Variables** for `apps/admin`:

| Variable Name | Required | Example Production Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://trustpay-api.onrender.com/api/v1` | Public HTTPS URL of the deployed Render backend API. |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | `pk_live_...` (or `pk_test_...`) | Clerk Publishable Key matching your Clerk instance. |

---

## 4. Superadmin Portal (`apps/superadmin`) — Vercel Dashboard Variables

Configure these in the **Vercel Project Settings > Environment Variables** for `apps/superadmin`:

| Variable Name | Required | Example Production Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://trustpay-api.onrender.com/api/v1` | Public HTTPS URL of the deployed Render backend API. |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | `pk_live_...` (or `pk_test_...`) | Clerk Publishable Key matching your Clerk instance. |

---

## 5. Verification Checklist

- [ ] All production environment variables configured in Render.
- [ ] Render Web Service builds with `npm run build:shared && npm run build:api`.
- [ ] Render Web Service starts with `npm run start:api`.
- [ ] Health endpoint `GET /api/v1/health` responds HTTP 200.
- [ ] Database health endpoint `GET /api/v1/health/database` responds HTTP 200 with `status: "connected"`.
- [ ] All three Vercel projects configured with `VITE_API_URL` and `VITE_CLERK_PUBLISHABLE_KEY`.
- [ ] Cashfree Phase 5 remains **DEFERRED** (`PAYMENTS_LIVE_ENABLED=false`).

