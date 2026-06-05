# Deployment

## Production Architecture

Production is Docker Compose only.

Required architecture:

```text
VPS
Docker Engine
Docker Compose
Nginx
Let's Encrypt SSL
PostgreSQL Container
Next.js Container
```

Do not reintroduce PM2 production deployment.

Do not run the database in the app container.

Do not use SQLite.

## Docker Compose

Actual `docker-compose.yml` has two services:

- `postgres`
- `app`

The `postgres` service:

- image: `postgres:16-alpine`
- container name: `resource-pool-postgres`
- `restart: unless-stopped`
- environment:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
- port: `5432:5432`
- volume: `postgres_data:/var/lib/postgresql/data`
- healthcheck with `pg_isready`

The `app` service:

- builds from local `Dockerfile`
- container name: `resource-pool-app`
- `restart: unless-stopped`
- depends on healthy `postgres`
- exposes `3000:3000`
- uses `DATABASE_URL` pointing to host `postgres`
- reads JWT, app name, and seed environment variables.

Required volume:

```yaml
volumes:
  postgres_data:
    name: postgres_data
```

## Dockerfile

The Dockerfile uses three stages:

1. `deps`: `node:22-alpine`, `npm ci`.
2. `builder`: copies source and runs `npm run build`.
3. `runner`: production runtime, copies `.next`, `node_modules`, `prisma`, `scripts`, and runs `scripts/docker-start.sh`.

Runtime command:

```dockerfile
CMD ["sh", "./scripts/docker-start.sh"]
```

## Container Startup

`scripts/docker-start.sh`:

```sh
#!/bin/sh
set -e

npx prisma migrate deploy
npm run start
```

This means production startup applies pending Prisma migrations before starting Next.js.

## Environment Variables

`.env.example` includes:

```text
DATABASE_URL="postgresql://postgres:resource_pool_password@localhost:5432/resource_pool?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_NAME="Resource Pool Management System"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="resource_pool_password"
POSTGRES_DB="resource_pool"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="replace-with-a-strong-admin-password"
SEED_VIEWER_USERNAME="viewer"
SEED_VIEWER_PASSWORD="replace-with-a-strong-viewer-password"
```

For production, require strong non-default secrets and passwords.

## Local Development

Typical local flow:

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npx prisma migrate dev
npm run db:seed
npm run dev
```

On Windows in this workspace, use:

```bash
npm.cmd run lint
npm.cmd run build
```

## First Production Deploy

On VPS:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:seed
```

Enable Docker autostart:

```bash
sudo systemctl enable docker
```

## Production Update

Standard code update:

```bash
git pull
docker compose build
docker compose up -d
```

Equivalent one-shot:

```bash
git pull
docker compose up -d --build
```

Because PostgreSQL uses the named volume `postgres_data`, rebuilding images and restarting containers must not delete data.

## Data Safety

Safe operations:

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

Data must remain after those operations:

- users,
- pools,
- pool fields,
- resources,
- relations.

Dangerous operations:

```bash
docker compose down -v
docker volume rm postgres_data
```

Never run or recommend these unless the user explicitly wants to delete production database data.

## Backup

Backup:

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup.sql
```

Timestamped backup:

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup_$(date +%F_%H%M%S).sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres resource_pool
docker compose restart app
```

Recommend backup before production upgrades and before migrations.

## Nginx

Nginx should reverse proxy to:

```text
http://127.0.0.1:3000
```

Required headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_cache_bypass $http_upgrade;
```

## HTTPS

Use Certbot with Nginx:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot renew --dry-run
```

## Acceptance Checks

Scenario 1:

```bash
docker compose down
docker compose up -d
```

Expected: data preserved.

Scenario 2:

```bash
git pull
docker compose up -d --build
```

Expected: data preserved.

Scenario 3:

```text
VPS reboot
Docker autostarts
PostgreSQL and Next.js containers recover
Nginx serves the domain
Data preserved
```
