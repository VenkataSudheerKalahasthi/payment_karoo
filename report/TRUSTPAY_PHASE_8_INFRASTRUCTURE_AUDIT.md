# TRUSTPAY ENTERPRISE v2.0 — INFRASTRUCTURE AUDIT
## Phase 8.1 & 8.2 Production Infrastructure & Hosting Provider Evaluation

**Date:** November 1, 2026  
**Project:** TrustPay Enterprise v2.0  
**Workspace:** `D:\Payment_mama`  
**Repository:** `https://github.com/VenkataSudheerKalahasthi/payment_karoo`  
**Author:** Principal DevOps Architect & Senior Full-Stack Infrastructure Engineer  

---

## 1. Executive Summary

This audit assesses the infrastructure, deployment topology, and production readiness of TrustPay Enterprise v2.0 across all five monorepo workspaces (`packages/shared`, `apps/api`, `apps/web`, `apps/admin`, `apps/superadmin`).

The platform employs a **modular monolith architecture**:
- **One central backend** (`apps/api`) serves all application features and administrative capabilities.
- **Three independent frontends** (`apps/web`, `apps/admin`, `apps/superadmin`) target distinct user roles.
- **One central database** (`Supabase PostgreSQL`) persists all platform state with Prisma ORM 7.10.1.
- **Cashfree Payment Gateway is DEFERRED** in Phase 8 by mandatory business decision. Financial safety flags remain fail-closed (`isLiveMoneyDisabled = true`, `PAYMENTS_LIVE_ENABLED = false`, `ESCROW_LIVE_MOVEMENT_ENABLED = false`, `PAYOUTS_ENABLED = false`).

---

## 2. Monorepo Workspace Topology & Port Allocations

| Workspace | Directory | Role & Tech Stack | Dev Port | Prod Build Command | Prod Start Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`@trustpay/shared`** | `packages/shared` | Core TypeScript types, DTOs, enums, calculation utilities | N/A | `npm run build:shared` (`tsc`) | Compiled into consuming packages |
| **`@trustpay/api`** | `apps/api` | Central Express REST API, Prisma 7, Clerk, Rate Limiter | `5000` | `npm run build:api` (`tsc -p tsconfig.build.json`) | `node dist/server.js` (`npm start`) |
| **`@trustpay/web`** | `apps/web` | Client & Specialist Portal (React 19, Vite, Tailwind) | `3000` | `npm run build:web` (`tsc && vite build`) | Static SPA (`dist/`) via CDN/Host |
| **`@trustpay/admin`** | `apps/admin` | Administrative Portal (Contracts oversight, disputes, ledgers) | `3001` | `npm run build:admin` (`tsc && vite build`) | Static SPA (`dist/`) via CDN/Host |
| **`@trustpay/superadmin`** | `apps/superadmin`| Executive Governance (Global telemetry, resolution policy) | `3002` | `npm run build:superadmin` (`tsc && vite build`) | Static SPA (`dist/`) via CDN/Host |

---

## 3. Dependency & Connectivity Map

```
                     ┌─────────────────────────────────────────────────────────┐
                     │                  @trustpay/shared                       │
                     └──────────┬──────────────────┬──────────────────┬────────┘
                                │                  │                  │
        ┌───────────────────────┼──────────────────┼──────────────────┼────────────────────────┐
        │                       │                  │                  │                        │
        ▼                       ▼                  ▼                  ▼                        ▼
 ┌───────────────┐       ┌───────────────┐  ┌───────────────┐  ┌────────────────┐       ┌──────────────┐
 │   apps/web    │       │  apps/admin   │  │apps/superadmin│  │    apps/api    │       │    tests/    │
 │ (Client/Work) │       │(Auditor/Admin)│  │ (Governance)  │  │(Express Server)│       │   (Vitest)   │
 └───────┬───────┘       └───────┬───────┘  └───────┬───────┘  └───────┬────────┘       └──────────────┘
         │                       │                  │                  │
         └───────────────────────┼──────────────────┘                  │
                                 │ HTTP(S) / REST                      │
                                 ▼                                     │
                     ┌────────────────────────┐                        │
                     │    Central API Gateway │                        │
                     │       (apps/api)       │                        │
                     └───────────┬────────────┘                        │
                                 │                                     │
                   ┌─────────────┴─────────────┐                       │
                   ▼                           ▼                       │
         ┌───────────────────┐       ┌────────────────────┐            │
         │ Supabase Database │       │ Clerk Auth Service │            │
         │   (PostgreSQL)    │       │ (JWT Verification) │            │
         └───────────────────┘       └────────────────────┘            │
```

---

## 4. Hosting Provider Evaluation & Comparison

We evaluated production hosting options for TrustPay with strict consideration for Node.js 24 compatibility, monorepo support, custom domains, HTTPS, and zero unexpected costs.

### A. Frontend Hosting Options (for `apps/web`, `apps/admin`, `apps/superadmin`)

| Provider | Free Tier & Pricing | Monorepo Support | Custom Domains & HTTPS | SPA Routing / Rewrites | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Generous free tier (Hobby). Zero cost for personal/dev projects. | **Native**. Direct monorepo root-dir support (`apps/web`, etc.). | Automated SSL, free custom subdomains. | Native via `vercel.json` rewrites. | **RECOMMENDED (Primary)** |
| **Netlify** | Free tier (100GB bandwidth/mo). | Supported via `base` directory in `netlify.toml`. | Automated SSL, free custom subdomains. | Supported via `_redirects` (`/* /index.html 200`). | **RECOMMENDED (Alternative)** |
| **Cloudflare Pages** | Unlimited bandwidth free tier. | Monorepo support with build commands. | Automated SSL, Cloudflare edge network. | Supported via `_routes.json` or `_redirects`. | Excellent alternative |
| **Render Static** | Free tier for static sites. | Monorepo support via root directory setting. | Automated SSL. | Supported via rewrite rules. | Good alternative |

### B. Backend Hosting Options (for `apps/api`)

| Provider | Free / Starter Tier | Node.js 24 Support | Port / Environment Config | Zero-Downtime & WebSockets | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Render** | Free Web Service (spins down after inactivity; \$7/mo for active). | **Native**. Node 24 supported via `package.json` engines. | Dynamic `$PORT` binding natively supported. | Free tier sleeps after 15m idle; active plan keeps alive. | **RECOMMENDED (Primary)** |
| **Railway** | \$5 trial credit; usage-based (\$5/mo starter). | **Native**. Automatic Nixpacks detection. | Dynamic `$PORT` binding natively supported. | No cold-sleep on active plans; persistent connections. | **RECOMMENDED (Alternative)** |
| **Fly.io** | Pay-as-you-go; requires card for VM allocation. | Supported via buildpacks. | Manual port allocation required. | Low latency edge deployment. | More complex setup |

### C. Database & Storage

- **Database**: Preserved on **Supabase PostgreSQL**. The existing database contains all 38 tables, 4 roles, 7 skills, and seed users. Connected via AWS pooler (`aws-0-eu-north-1.pooler.supabase.com:5432`).
- **Storage**: Preserved on **Supabase Storage**. Evidence files and deliverables are signed using HMAC tokens and served via authenticated routes.

---

## 5. Recommended Architecture Combination

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                RECOMMENDED TOPOLOGY                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Frontend Web Portal:    Vercel (root: apps/web)         -> app.yourdomain.com       │
│ 2. Frontend Admin Portal:  Vercel (root: apps/admin)       -> admin.yourdomain.com     │
│ 3. Frontend Superadmin:    Vercel (root: apps/superadmin)  -> superadmin.yourdomain.com│
│ 4. Central Express API:    Render Web Service (apps/api)   -> api.yourdomain.com       │
│ 5. Database & Storage:     Supabase PostgreSQL & Storage   -> Active Managed Instance  │
│ 6. Authentication:         Clerk (Production Instance)      -> Shared across all apps   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Why this combination is optimal:**
1. **Separation of Concerns**: Frontends are statically hosted on global edge networks (fast TTFB, automatic SSL, zero server load).
2. **Cost-Effective**: Can be deployed entirely on free/starter tiers during staging and initial launch.
3. **Simplicity**: No complex infrastructure to manage (Docker, Kubernetes, or VMs are avoided per strict project restrictions).
4. **Resilience**: The central backend runs as a continuous service handling database queries, authentication verification, and rate limiting.

---

## 6. Audit Findings & Resolution Matrix

| Component | Audit Observation | Production Readiness Resolution |
| :--- | :--- | :--- |
| **Cloud Port Binding** | `env.API_PORT` formerly only checked `API_PORT=5000` | **Resolved**: Updated `apps/api/src/config/env.config.ts` to check `process.env.PORT || process.env.API_PORT || '5000'`. |
| **SPA Route Rewrites** | Frontends had no `_redirects` or `vercel.json` | **Resolved**: Added `_redirects` (`/* /index.html 200`) and `vercel.json` to `apps/web`, `apps/admin`, and `apps/superadmin`. |
| **Localhost Fallback Guard**| Backend had soft defaults for `CLIENT_URL` and `CORS_ORIGINS` | **Resolved**: Added strict Zod `superRefine` in `env.config.ts` rejecting localhost URLs in `NODE_ENV=production`. |
| **Production Startup Script**| Root `package.json` had no `npm start` | **Resolved**: Added `"start": "npm run start:api"` and `"start:api": "npm run start --workspace=@trustpay/api"`. |
| **Database Connection Pooler**| Direct port 5432 vs Pooler port 5432 | **Verified**: Active AWS Supabase pooler connection is confirmed and responsive. |
| **Cashfree Gateway Status**| Gateway configuration was pending Sandbox keys | **Resolved**: Cashfree implementation is **DEFERRED**. Safety guards remain locked. |

