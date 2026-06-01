CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Optional bootstrap file for teams that prefer SQL-first provisioning.
-- The Prisma migration in prisma/migrations/000001_init is the source of truth.
-- After importing this file, run:
--   npx prisma migrate deploy
--   npm run db:seed
