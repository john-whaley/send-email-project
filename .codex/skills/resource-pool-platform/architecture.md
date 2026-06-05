# Architecture

## Overview

This repository implements a dynamic resource-pool management platform.

The application lets admins create arbitrary resource pool types, define fields for each pool, add resources, and create generic relations between any two resources. Users can search, browse, and query relations.

Core implementation:

- `app/`: Next.js App Router pages and API routes.
- `components/`: client UI and feature components.
- `components/ui/`: local shadcn-style primitives.
- `lib/`: auth, Prisma client, validators, resource helpers, utility functions.
- `prisma/`: schema, migrations, seed.
- `scripts/docker-start.sh`: production container start script.
- `docs/deployment.md`: VPS/Docker/Nginx deployment guide.

## Runtime Stack

From `package.json`:

- `next` `^15.0.0`
- `react` / `react-dom` `^19.0.0`
- `typescript` `^5.7.2`
- `prisma` / `@prisma/client`
- `tailwindcss`
- `bcryptjs`
- `jsonwebtoken`
- `zod`
- `xlsx`
- `lucide-react`

## Authentication And Authorization

Auth lives in `lib/auth.ts`.

- Login signs a JWT session token.
- Token is stored in HTTP-only cookie `session`.
- Session max age is one week.
- Production cookies use `secure: true`.
- Roles are Prisma enum `ADMIN` and `USER`.
- `requireUser()` redirects unauthenticated users to `/login`.
- `requireAdmin()` redirects non-admin users to `/dashboard`.
- API routes must check current user and role before writes.

Do not display seed credentials or default passwords in login UI.

## Main Pages

Current user-facing routes:

- `/login`: login.
- `/dashboard`: overview with stats, recent items, and paginated resource-pool cards.
- `/pools/[poolId]`: resource list and resource form for a single pool.
- `/relations`: main relation explorer.
- `/search`: global search.
- `/admin/pools`: pool and field management.
- `/admin/resources`: resource management and CSV/XLS/XLSX import.
- `/settings`: user center.

## App Shell And Navigation

`components/app-shell.tsx` renders navigation.

Pools are loaded dynamically from the database, so creating a new pool should automatically affect navigation and resource entry surfaces. Do not hardcode pool types such as phone/account/platform in navigation logic.

## Dynamic Pool Model

Admins create resource pools in `/admin/pools`.

Each pool has:

- `name`
- `slug`
- optional `description`
- ordered dynamic fields

Each field has:

- `fieldName`
- `label`
- `fieldType`
- `required`
- `unique`
- `sortOrder`

Supported `FieldType` enum values:

```text
TEXT, PASSWORD, NUMBER, BOOLEAN, DATE, URL, EMAIL, PHONE, JSON
```

## Resource Items

Resources are handled mainly by:

- `components/resources/resource-manager.tsx`
- `app/api/pools/[poolId]/items/route.ts`
- `app/api/pools/[poolId]/items/[itemId]/route.ts`
- `lib/resource.ts`

Rules and behavior:

- Resource item business data lives in `pool_items.data` JSONB.
- Forms are generated from the pool's dynamic fields.
- `normalizeItemData()` validates and normalizes dynamic field values.
- `assertNoDuplicateKeyFields()` checks duplicate values for fields marked `required` or `unique`.
- Sensitive field names containing `password`, `token`, or `secret` are masked in table display.
- Default list page size is 6.
- Resource list default order is stable by `id` ascending.
- The `updatedAt` column supports sorting by updated time.
- Saving an item should preserve the current page instead of jumping back to page 1.
- Resource list supports batch delete.

## Pool Admin

`components/admin/pool-admin.tsx` manages pools and fields.

Current behavior:

- Default page size is 6.
- Page footer shows total count.
- Admins can create, edit, delete, and duplicate a pool.
- When duplicating a pool, the new-pool panel can optionally copy existing resource data from the source pool.
- Copying pool data copies only `pool_items.data`; it must not copy relations.
- Deleting a pool cascades through fields, items, and relations via database constraints.

## Admin Resources

`components/admin/admin-resources.tsx` handles cross-pool resource management.

Current behavior:

- Pool selector uses `SearchableSelect`.
- The searchable selector is an input-style dropdown with fixed max height and scroll after about 8 rows.
- Resource import supports CSV, XLS, and XLSX via `xlsx`.

## Relation Explorer

`components/relations/relation-explorer.tsx` is the core relation query UI.

The user selects:

1. source pool type,
2. source item,
3. target pool type.

The page shows:

- related target items,
- unrelated target items.

Current behavior:

- Source pool, source item, and target pool selectors use `SearchableSelect`.
- Related and unrelated lists both have search, pagination, and total count.
- Default page size is 6.
- Unrelated list supports single link and batch link.
- Related list supports single relation delete and batch relation delete.
- Related list has a reverse lookup button: clicking a related row swaps source/target pool roles, makes the clicked item the new source item, clears searches, and refreshes results.
- The relation explorer must preserve a manually selected source item across `router.refresh()` calls when it still exists.

## Searchable Select

`components/ui/searchable-select.tsx` is a local input-style dropdown.

Use it for high-cardinality selectors such as:

- source pool type,
- source item,
- target pool type,
- admin resource pool selector.

Properties:

- accepts string `value`,
- accepts `{ value, label, searchText? }[]`,
- filters by label, value, and search text,
- opens on focus/click,
- Enter selects the first filtered option,
- Escape closes,
- max height uses `max-h-72` with vertical scrolling.

## API Surface

Important API routes:

- `GET/POST /api/pools`
- `GET/PATCH/DELETE /api/pools/[poolId]`
- `GET/POST/DELETE /api/pools/[poolId]/items`
- `GET/PATCH/DELETE /api/pools/[poolId]/items/[itemId]`
- `GET/POST/DELETE /api/relations`
- `DELETE /api/relations/[relationId]`
- `GET /api/relations/unrelated`
- `GET /api/search`
- `POST /api/import`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

For new write APIs, always enforce login and admin role unless the request is explicitly read-only.

## Import

`app/api/import/route.ts` supports CSV/XLS/XLSX.

Import rules:

- Parse headers as field names.
- Normalize values using the same resource helpers as manual item creation.
- Run duplicate checks.
- Track imported and failed counts.

## UI Conventions

- Use local UI primitives in `components/ui`.
- Use lucide-react icons for actions.
- Keep operational screens compact and data-focused.
- Avoid landing-page or marketing-style layouts for admin workflows.
- Keep page sections functional; cards are appropriate for records, forms, and panels.
