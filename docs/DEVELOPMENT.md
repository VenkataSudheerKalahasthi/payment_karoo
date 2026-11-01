# TrustPay Enterprise v2.0 &mdash; Developer Guide

## 1. Prerequisites

- **Node.js**: `v24.x LTS` (verified compatible with `v24.14.0+`)
- **npm**: `v10.x` or `v11.x` (verified with `v11.9.0+`)
- **PostgreSQL**: `v15+` (local or hosted instance)

---

## 2. Initial Setup

### Step 1: Install Dependencies

From the repository root, install dependencies across all workspaces:

```bash
npm install
```

### Step 2: Environment Configuration

Copy `.env.example` to `.env` in the root and in the respective apps as needed:

```bash
cp .env.example .env
```

Verify `DATABASE_URL` matches your local PostgreSQL credentials.

### Step 3: Generate Prisma Client

```bash
npm run prisma:generate --workspace=@trustpay/api
```

### Step 4: Build Shared Package

```bash
npm run build:shared
```

---

## 3. Development Commands

### Run All Applications Concurrently

Starts the API server and all three frontends in parallel with colored process output:

```bash
npm run dev
```

### Run Individual Applications

| Command                  | Workspace              | Target Port | URL                                   |
| ------------------------ | ---------------------- | ----------- | ------------------------------------- |
| `npm run dev:api`        | `@trustpay/api`        | 5000        | `http://localhost:5000/api/v1/health` |
| `npm run dev:web`        | `@trustpay/web`        | 3000        | `http://localhost:3000`               |
| `npm run dev:admin`      | `@trustpay/admin`      | 3001        | `http://localhost:3001`               |
| `npm run dev:superadmin` | `@trustpay/superadmin` | 3002        | `http://localhost:3002`               |

---

## 4. Verification & Quality Commands

### Type-Checking All Packages

Verifies TypeScript compilation without emitting files across `@trustpay/shared`, `@trustpay/api`, `@trustpay/web`, `@trustpay/admin`, and `@trustpay/superadmin`:

```bash
npm run typecheck
```

### Production Build

Builds all applications for production deployment:

```bash
npm run build
```

### Code Formatting & Linting

```bash
npm run lint
npm run format:check
npm run format
```

---

## 5. Network & Port Allocation Map

- `5000`: Central Express Backend (`/api/v1`)
- `3000`: Client & Worker Web Portal
- `3001`: Admin Operations & Mediation Portal
- `3002`: Superadmin Governance Portal
- `5432`: PostgreSQL Relational Database
