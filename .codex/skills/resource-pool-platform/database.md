# Database

## Provider

The database is PostgreSQL only.

Prisma datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Do not introduce SQLite.

## Prisma Models

The schema lives in `prisma/schema.prisma`.

Enums:

```text
Role: ADMIN, USER
FieldType: TEXT, PASSWORD, NUMBER, BOOLEAN, DATE, URL, EMAIL, PHONE, JSON
```

Tables:

- `users`
- `pools`
- `pool_fields`
- `pool_items`
- `relations`

## Users

Prisma model `User`, mapped to `users`.

Fields:

- `id`
- `username` unique
- `passwordHash` mapped to `password_hash`
- `role`
- `createdAt` mapped to `created_at`
- `updatedAt` mapped to `updated_at`

Relations:

- `createdRelations` points to relations created by the user.

## Pools

Prisma model `Pool`, mapped to `pools`.

Fields:

- `id`
- `name` unique
- `slug` unique
- `description`
- `createdAt`
- `updatedAt`

Relations:

- `fields`
- `items`
- `sourceRelations`
- `targetRelations`

Design intent:

- A pool is a dynamic resource category.
- New business categories must be modeled as data, not code.

## Pool Fields

Prisma model `PoolField`, mapped to `pool_fields`.

Fields:

- `id`
- `poolId`
- `fieldName`
- `label`
- `fieldType`
- `required`
- `unique`
- `sortOrder`
- timestamps

Constraints:

- `@@unique([poolId, fieldName])`
- on delete of pool: cascade.

Rules:

- Field names are used as JSON keys in `pool_items.data`.
- Field names should be stable after resources exist; changing/removing a field can make existing JSON data harder to interpret.
- Use validators in `lib/validators.ts`.

## Pool Items

Prisma model `PoolItem`, mapped to `pool_items`.

Fields:

- `id`
- `poolId`
- `data Json @db.JsonB`
- `createdAt`
- `updatedAt`

Indexes:

- `@@index([poolId])`

Relations:

- belongs to one pool,
- can appear as source item or target item in many relations.

Rules:

- Business data must remain in JSONB.
- Use `normalizeItemData()` for coercion and validation.
- Use `assertNoDuplicateKeyFields()` before create/update/import.
- Required or unique fields are treated as duplicate-check keys.
- Resource list default order should be stable by `id` ascending unless the user explicitly asks for a different sort.

## Relations

Prisma model `Relation`, mapped to `relations`.

Fields:

- `id`
- `sourcePoolId`
- `sourceItemId`
- `targetPoolId`
- `targetItemId`
- `note`
- `createdById`
- `createdAt`

Constraints and indexes:

- `@@unique([sourcePoolId, sourceItemId, targetPoolId, targetItemId])`
- `@@index([sourcePoolId, sourceItemId])`
- `@@index([targetPoolId, targetItemId])`

Foreign keys:

- source and target pools delete cascade,
- source and target items delete cascade,
- `createdBy` set null on user deletion.

Relation behavior:

- The database unique constraint stores one direction.
- Query code treats relations as effectively bidirectional by checking both the forward and reverse directions.
- Do not create duplicate reverse rows to represent the same logical relationship.
- Deleting a relation must not delete the related resources.

## Migration

Initial migration:

```text
prisma/migrations/000001_init/migration.sql
```

Production startup runs:

```bash
npx prisma migrate deploy
```

Migration rules:

- Preserve compatibility with existing production data.
- Avoid destructive migrations unless the user explicitly approves a data migration plan and backup.
- Do not reset production databases.
- Use Prisma migrations for schema changes.

## Seed

Seed command:

```bash
npm run db:seed
```

Docker command:

```bash
docker compose exec app npm run db:seed
```

Seed credentials are read from environment variables:

- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD`
- `SEED_VIEWER_USERNAME`
- `SEED_VIEWER_PASSWORD`

Never hardcode public default passwords in login UI or docs intended for production.

## Backup And Restore

Canonical backup:

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup.sql
```

Canonical restore:

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres resource_pool
```

Always recommend backup before production schema or deployment changes.
