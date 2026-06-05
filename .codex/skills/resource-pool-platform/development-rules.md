# Development Rules

## General Workflow

1. Read the relevant existing code before editing.
2. Keep changes incremental.
3. Preserve the current database shape unless schema work is required.
4. Prefer existing helpers and UI primitives.
5. Run lint and build after meaningful changes.

Validation:

```bash
npm.cmd run lint
npm.cmd run build
```

Use `npm run ...` on non-Windows shells.

## Architecture Rules

- Keep Next.js App Router.
- Keep Prisma and PostgreSQL.
- Keep dynamic resource pools driven by `pools`, `pool_fields`, and `pool_items`.
- Do not hardcode future pool types into code.
- Keep relations generic and pool-agnostic.
- Keep RBAC checks on write APIs.
- Keep Docker Compose production deployment as the only production path.

## Data Safety Rules

- Highest priority is preserving PostgreSQL data.
- Never introduce SQLite.
- Never put the database inside the app container.
- Never recommend `docker compose down -v` unless explicitly deleting production data.
- Always mention backup before risky production changes.
- Prefer additive, backwards-compatible migrations.

## Auth Rules

- Use `getCurrentUser()`, `requireUser()`, and `requireAdmin()` patterns from `lib/auth.ts`.
- Use HTTP-only JWT session cookie.
- Admin-only APIs must reject non-admin users with 403.
- Login UI must require manual credential input.
- Never display seed passwords or hardcoded production credentials.

## API Rules

- Validate request payloads with zod schemas in `lib/validators.ts`.
- Use `ok()` and `fail()` from `lib/api.ts` for JSON responses.
- Use `toInt()` when parsing route params.
- Normalize dynamic resource data with `normalizeItemData()`.
- Run `assertNoDuplicateKeyFields()` before resource create/update/import.
- When creating relations, prevent self-relations and duplicate bidirectional relations.
- When deleting relations, delete only relation records, not resources.
- Batch deletes should accept validated positive integer `ids`.

## Resource Rules

- Resource business data belongs in `pool_items.data` JSONB.
- Display names should use `getItemDisplayName()`.
- Sensitive values should use `maskSensitiveValue()`.
- Resource lists default to 6 rows per page.
- Resource lists default to stable `id` ascending order.
- Updating or adding a resource should not force the user back to page 1.
- Updated-time sorting is a UI mode, not the default persistence order.
- Batch delete must be available on resource lists.

## Pool Admin Rules

- Pool field names are JSON keys; treat them as durable once data exists.
- Pool duplication can copy field structure.
- The optional "copy resource data" behavior copies only item JSON data.
- Do not copy relations during pool duplication.
- Pool list default page size is 6 and should show total count.
- Deleting a pool is destructive; keep confirmation prompts.

## Relation Explorer Rules

- Relation explorer uses source pool, source item, and target pool.
- The query must treat stored relations as bidirectional.
- Show both related and unrelated target objects.
- Related and unrelated lists must support pagination and total count.
- Unrelated list supports search, single link, and batch link.
- Related list supports search, single delete, batch delete, and reverse lookup.
- Reverse lookup sets the clicked related item as the new source item and swaps source/target pool roles.
- Changing selection or search should reset only the relevant list state.
- Preserve the selected source item across `router.refresh()` when it still exists.

## Searchable Select Rules

- Use `components/ui/searchable-select.tsx` for high-cardinality selectors.
- It should be input-style, searchable, fixed-height, and scrollable after about 8 visible rows.
- Use it for source pool, source item, target pool, and admin resource pool selectors.
- Include useful `searchText`, such as slug, description, or JSON data, when available.

## UI Rules

- Use lucide-react icons for action buttons.
- Keep admin/productivity screens dense and scan-friendly.
- Do not create marketing or landing-page layouts for operational pages.
- Include clear empty states.
- Include total counts in pagination footers.
- Keep Chinese UI copy consistent with existing product language.

## Import Rules

- Support CSV, XLS, and XLSX.
- Use the same normalization and duplicate checks as manual creation.
- Report imported and failed counts.
- Do not bypass field validation during import.

## Deployment Rules During Development

- Keep `docker-compose.yml` with `app` and `postgres` services.
- Keep `restart: unless-stopped` on both containers.
- Keep `postgres_data:/var/lib/postgresql/data`.
- Keep app startup migration via `npx prisma migrate deploy`.
- Keep Docker deployment docs aligned with README and `docs/deployment.md`.
- Do not add PM2 production instructions.

## Known Local Build Issue

On Windows, `npm.cmd run build` may fail with:

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node
```

Cause: a running Next.js/dev process can hold the Prisma engine DLL.

Fix:

1. Check port 3000.
2. Stop the owning process.
3. Rerun build.

## When Adding New Features

Before coding, identify whether the feature affects:

- schema,
- dynamic fields,
- resource JSON,
- relation semantics,
- auth/RBAC,
- deployment/data safety.

Then read the corresponding Skill reference file and inspect the live code. Implement narrowly, verify with lint/build, and update docs if deployment or operational behavior changes.
