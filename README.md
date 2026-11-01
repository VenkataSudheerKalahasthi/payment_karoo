# TrustPay Enterprise v2.0

> **Secure Digital Contract & Escrow Management Platform**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](<>)

TrustPay Enterprise v2.0 is a production-oriented digital contract signing, milestone escrow management, and dispute arbitration platform. It provides cryptographic certainty, milestone escrow custody, and regulatory compliance for enterprise client-contractor engagements.

---

## Architecture Overview

TrustPay Enterprise is implemented as a **modular monolith** with three independent frontends communicating with a central Express API and PostgreSQL database:

```
TrustPay-Enterprise/
├── apps/
│   ├── web/                 # Client and Worker portal (Port 3000)
│   ├── admin/               # Operations and Dispute Mediation portal (Port 3001)
│   ├── superadmin/          # System Governance & Audit portal (Port 3002)
│   └── api/                 # Central Express Backend (Port 5000)
├── packages/
│   └── shared/              # Shared types, health models, and utilities
├── docs/
│   ├── ARCHITECTURE.md      # Full architecture specification
│   ├── DATABASE.md          # Database connection and lifecycle management
│   └── DEVELOPMENT.md       # Developer guide & operational commands
├── .env.example             # Monorepo environment configuration template
├── .gitignore
├── package.json             # Root workspace orchestration
└── README.md
```

---

## Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Three.js, Lucide React, Redux Toolkit, Axios, Recharts.
- **Backend**: Node.js 24, Express.js, TypeScript, Prisma ORM, PostgreSQL, Zod, Helmet, CORS, Express Rate Limit.
- **Authentication**: Clerk SDK preparation (`@clerk/clerk-react`, `@clerk/backend`).
- **Workspace**: npm workspaces.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

### 3. Generate Prisma Client & Build Shared Package

```bash
npm run prisma:generate --workspace=@trustpay/api
npm run build:shared
```

### 4. Run Development Servers

```bash
# Start all 4 services concurrently (API + 3 Frontends)
npm run dev

# Or run services individually:
npm run dev:api         # http://localhost:5000
npm run dev:web         # http://localhost:3000
npm run dev:admin       # http://localhost:3001
npm run dev:superadmin  # http://localhost:3002
```

---

## Verification Endpoints

The central API exposes structured health check endpoints:

- `GET http://localhost:5000/api/v1/health` &mdash; Returns API availability, service uptime, and environment telemetry.
- `GET http://localhost:5000/api/v1/health/database` &mdash; Verifies PostgreSQL connectivity and measures query latency.

---

## Documentation

- [System Architecture](file:///d:/Payment_mama/docs/ARCHITECTURE.md)
- [Database Lifecycle](file:///d:/Payment_mama/docs/DATABASE.md)
- [Development Workflow](file:///d:/Payment_mama/docs/DEVELOPMENT.md)
