# TrustPay Enterprise v2.0 &mdash; Database Foundation & Lifecycle

## 1. Overview

TrustPay Enterprise v2.0 utilizes **PostgreSQL** as its primary relational database engine, managed via **Prisma ORM**. PostgreSQL was selected for its robust ACID compliance, proven concurrency handling, and support for high-precision numeric types critical for financial escrow ledgers.

---

## 2. Configuration & Connection String

Database connectivity is managed exclusively through the standard `DATABASE_URL` environment variable:

```bash
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=<SCHEMA>"
```

### Development Default

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trustpay_enterprise?schema=public"
```

The database connection string is validated upon application boot using Zod in `apps/api/src/config/env.config.ts`.

---

## 3. Centralized Connection Lifecycle Management (Prisma 7 Architecture)

In Prisma 7, connection URLs for migrations are declared via `prisma.config.ts`, while client runtime connectivity uses official driver adapters (`@prisma/adapter-pg` paired with a `pg.Pool` connection pool).

The Prisma Client instance is managed as a singleton in `apps/api/src/config/prisma.ts`:

### 3.1 Singleton Instantiation with PostgreSQL Driver Adapter

In development mode, both the `pg.Pool` and `PrismaClient` instances are cached on Node's `globalThis` to prevent connection leaks during hot-module reloading:

```typescript
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const { Pool } = pg;

export const pool =
  globalThis.__trustpay_pg_pool__ ??
  new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalThis.__trustpay_prisma__ ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
```

### 3.2 Health Check & Latency Probing

The database connection is actively probed via raw query execution without blocking server initialization:

```typescript
export async function checkDatabaseConnection(): Promise<DbHealthResult> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;
    return { status: 'connected', database: 'PostgreSQL', latencyMs };
  } catch (error) {
    return { status: 'disconnected', database: 'PostgreSQL', error: error.message };
  }
}
```

This health status is exposed to frontend portals via:
`GET /api/v1/health/database`

### 3.3 Graceful Teardown

On `SIGINT` and `SIGTERM` signals, the backend terminates HTTP listeners first and executes `prisma.$disconnect()` to gracefully drain all pool connections before exiting.

---

## 4. Schema Strategy (Phase 1 Status)

Per Phase 1 requirements, business domain tables (such as contracts, milestones, escrow ledgers, and dispute cases) are strictly deferred to Phase 2 (Database & Data Modeling).

The Phase 1 schema defines only the system verification model:

- `SystemHealthCheck`: Used to validate Prisma generation and migration pipelines.

---

## 5. Prisma CLI Commands

Run the following commands within `apps/api`:

```bash
# Generate the Prisma Client
npm run prisma:generate

# Validate the schema format
npm run prisma:validate
```
