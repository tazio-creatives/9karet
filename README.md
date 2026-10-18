# 9KARET

9K gold & gemstone jewellery ecommerce platform ("Smart Gold") — forked from the BOX DIAMONDS platform: every product is BIS-hallmarked 9K gold, set with stones whose weight and price are entered per product (no diamonds). Monorepo (npm workspaces) with three independent apps plus a shared package.

Architecture, database schema, API plan, and the full phased build plan live in the original BOX DIAMONDS plan document: `BOX-DIAMONDS-Architecture-Plan.pdf` (also at `~/.claude/plans/iridescent-swinging-stardust.md`). This README only covers running the repo day to day.

## Structure

```
backend/          Node.js + Express + PostgreSQL REST API
web/               Customer storefront — React + Vite + React Router
admin/             Admin panel — React + Vite + React Router
packages/shared/   Shared TS types, zod schemas, constants (order status, etc.)
```

## Requirements

- Node.js >= 20 (on Windows with nvm: `nvm use 22.20.0`)
- npm >= 10
- PostgreSQL (from Phase 1 onward — not required to run Phase 0's skeleton)

## Setup

```bash
npm install
cp backend/.env.example backend/.env
```

## Development

```bash
npm run dev:backend   # http://localhost:4000 — GET /api/v1/health
npm run dev:web       # http://localhost:5173
npm run dev:admin     # http://localhost:5174 (Vite auto-picks a free port)
```

## Linting & formatting

```bash
npm run lint
npm run format
npm run format:check
```

## Status

Phase 0 (repo scaffolding) — folders, boot skeletons, tooling. No database, business logic, or routing yet; those land in later phases per the approved phased build plan.
