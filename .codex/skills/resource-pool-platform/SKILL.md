---
name: resource-pool-platform
description: Project-specific guidance for the Resource Pool Management Platform in this repository. Use when Codex is asked to modify, extend, debug, deploy, document, or review this Next.js 15 + Prisma + PostgreSQL resource-pool system, especially work involving dynamic pools, pool fields, pool items, generic relations, relation explorer behavior, RBAC/JWT auth, Docker Compose deployment, or data-safety rules.
---

# Resource Pool Platform

Use this skill as the project onboarding guide before changing this repository.

## First Steps

1. Read the user's request and identify the affected surface:
   - Dynamic pool or field management: read `architecture.md` and `database.md`.
   - Resource item CRUD, duplicate checks, import, pagination, sorting, or batch delete: read `architecture.md`, `database.md`, and `development-rules.md`.
   - Relation explorer, related/unrelated lists, reverse lookup, or batch link/delete: read `architecture.md` and `development-rules.md`.
   - Docker, VPS, Nginx, SSL, backup, restore, or production upgrade: read `deployment.md`.
   - Schema or migration work: read `database.md` and `deployment.md`.

2. Scan the live files before editing. This project has had several incremental changes; do not assume older requirements are still represented in README alone.

3. Preserve the current architecture unless the user explicitly requests a rewrite.

## Project Facts

- App: Resource Pool Management System.
- Stack from `package.json`: Next.js 15 App Router, React 19, TypeScript, Prisma ORM, PostgreSQL JSONB, TailwindCSS, local shadcn-style UI components, bcryptjs, jsonwebtoken, xlsx, zod, lucide-react.
- Production deployment is Docker Compose only.
- Database is PostgreSQL only. SQLite is forbidden.
- Database must run in its own `postgres` container and persist in Docker volume `postgres_data`.
- Auth is JWT in an HTTP-only `session` cookie, with `ADMIN` and `USER` roles.
- Resource pools are dynamic: admins create pools and fields without code changes.
- Resource item data is stored as JSONB in `pool_items.data`.
- Generic many-to-many relations are stored in the `relations` table.

## Non-Negotiable Rules

- Do not remove existing features.
- Do not replace the dynamic-pool model with hardcoded resource types.
- Do not put PostgreSQL data inside the app container.
- Do not introduce SQLite.
- Do not document or recommend PM2 for production.
- Do not show default usernames/passwords on the login screen.
- Do not run destructive Docker commands such as `docker compose down -v` or `docker volume rm postgres_data` unless the user explicitly requests production data deletion.
- Keep data safety above deployment convenience.

## Validation

After code changes, run:

```bash
npm.cmd run lint
npm.cmd run build
```

On non-Windows shells, `npm run lint` and `npm run build` are fine.

If `npm.cmd run build` fails on Windows with a Prisma `query_engine-windows.dll.node` rename/EPERM error, a local Next process is probably holding the Prisma engine file. Check and stop the process on port 3000, then rerun build.

## Reference Files

- `architecture.md`: app structure, modules, routes, UI behavior, recent features.
- `database.md`: Prisma schema, tables, relations, JSONB model, invariants.
- `deployment.md`: Docker Compose, VPS, Nginx, SSL, migrations, backups, data safety.
- `development-rules.md`: rules for future feature work, testing, UX, API, deployment, and data integrity.
