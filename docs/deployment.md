# Docker Compose 生产部署文档

生产环境统一采用 Docker Compose 部署。

```text
VPS
Docker Engine
Docker Compose
Nginx
Let's Encrypt SSL
PostgreSQL Container
Next.js Container
```

最高优先级是数据安全：任何代码更新、镜像重建、容器重启、VPS 重启，都不得导致 PostgreSQL 数据丢失。

## 架构约束

- 数据库必须运行在独立 PostgreSQL 容器中
- 应用必须运行在独立 Next.js 容器中
- 禁止使用 SQLite
- 禁止把数据库放进应用容器
- PostgreSQL 数据必须使用 Docker Volume 持久化

Compose 服务必须是双容器结构：

```yaml
services:
  app:
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## VPS 准备

系统版本：

```text
Ubuntu 22.04
```

更新系统：

```bash
sudo apt update
sudo apt upgrade -y
```

安装基础工具：

```bash
sudo apt install -y ca-certificates curl gnupg nginx
```

安装 Docker Engine 和 Docker Compose 插件：

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

启用 Docker 开机自启动：

```bash
sudo systemctl enable docker
```

允许当前用户运行 Docker：

```bash
sudo usermod -aG docker $USER
```

重新登录 SSH 后验证：

```bash
docker --version
docker compose version
```

## 首次部署

进入项目目录：

```bash
cd /path/to/send-email-project
```

复制环境变量：

```bash
cp .env.example .env
```

编辑 `.env`：

```text
JWT_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace-db-password"
POSTGRES_DB="resource_pool"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="replace-with-a-strong-admin-password"
SEED_VIEWER_USERNAME="viewer"
SEED_VIEWER_PASSWORD="replace-with-a-strong-viewer-password"
```

启动：

```bash
docker compose up -d --build
```

应用容器启动时会自动执行：

```bash
npx prisma migrate deploy
```

首次部署后写入种子数据：

```bash
docker compose exec app npm run db:seed
```

查看容器：

```bash
docker compose ps
```

查看应用日志：

```bash
docker compose logs -f app
```

查看数据库日志：

```bash
docker compose logs -f postgres
```

## PostgreSQL 数据持久化

PostgreSQL 容器数据目录：

```text
/var/lib/postgresql/data
```

数据保存在 Docker Volume：

```text
postgres_data
```

查看 volume：

```bash
docker volume inspect postgres_data
```

安全操作：

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

这些操作不会删除 `postgres_data`，因此不会删除：

- 用户数据
- 池子
- 资源
- 关联关系

危险操作：

```bash
docker compose down -v
docker volume rm postgres_data
```

除非你明确要删除生产数据库，否则不要执行危险操作。

## 生产环境更新代码

推荐流程：

```bash
git pull
docker compose build
docker compose up -d
```

由于 PostgreSQL 使用 Docker Volume：

```text
postgres_data
```

因此数据库不会被重建。更新完成后验证：

```bash
docker compose ps
docker compose logs -f app
```

## 数据库备份

备份：

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup.sql
```

建议带日期保存：

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup_$(date +%F_%H%M%S).sql
```

## 数据库恢复

恢复：

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres resource_pool
```

恢复后重启应用：

```bash
docker compose restart app
```

## Nginx 反向代理

示例域名：

```text
https://your-domain.com
```

创建配置：

```bash
sudo nano /etc/nginx/sites-available/resource-pool
```

写入：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/resource-pool /etc/nginx/sites-enabled/resource-pool
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请 Let's Encrypt 证书：

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

验证自动续期：

```bash
sudo certbot renew --dry-run
```

## VPS 重启自动恢复

Docker 已启用开机自启动：

```bash
sudo systemctl enable docker
```

`docker-compose.yml` 中两个服务都配置了：

```yaml
restart: unless-stopped
```

因此 VPS 重启后：

- PostgreSQL 容器自动启动
- Next.js 容器自动启动
- Nginx 随系统服务启动
- 网站恢复访问
- 数据仍保存在 `postgres_data`

## 最终验收标准

场景 1：

```bash
docker compose down
docker compose up -d
```

验收：用户、池子、资源、关联关系全部保留。

场景 2：

```bash
git pull
docker compose up -d --build
```

验收：用户、池子、资源、关联关系全部保留。

场景 3：

```text
VPS 重启
Docker 自动启动
网站自动恢复
数据保留
```

验收：PostgreSQL 容器和 Next.js 容器自动恢复，网站可通过域名访问，数据库数据保留。
