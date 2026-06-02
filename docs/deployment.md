# 部署文档

本文档说明如何将资源池管理平台部署到 Ubuntu 22.04 VPS，并保证 PostgreSQL 数据在容器重建、代码升级、镜像重构后仍然保留。

## Docker 一键部署

项目根目录包含：

```text
Dockerfile
docker-compose.yml
.env
```

首次部署：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

```text
JWT_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
POSTGRES_PASSWORD="replace-db-password"
```

启动：

```bash
docker compose up -d --build
```

应用容器启动时会自动执行：

```bash
npx prisma migrate deploy
```

然后启动 Web 服务：

```bash
npm run start
```

访问：

```text
http://your-server-ip:3000
```

## PostgreSQL 独立容器

PostgreSQL 运行在独立容器 `resource-pool-db` 中，应用容器只通过网络连接数据库，不会把数据库放入应用容器内部。

Compose 中的数据库连接：

```text
postgresql://resource_pool:password@db:5432/resource_pool?schema=public
```

其中 `db` 是 Docker Compose 内部服务名。

## 数据持久化

PostgreSQL 数据使用 Docker named volume：

```yaml
volumes:
  postgres_data:
    name: resource_pool_postgres_data
```

容器内数据目录：

```text
/var/lib/postgresql/data
```

查看宿主机实际目录：

```bash
docker volume inspect resource_pool_postgres_data --format '{{ .Mountpoint }}'
```

只执行下面命令不会删除数据：

```bash
docker compose down
docker compose up -d
docker compose build
docker compose up -d --build
```

注意：不要执行下面命令，除非你明确要删除数据库：

```bash
docker compose down -v
docker volume rm resource_pool_postgres_data
```

## 数据库备份

创建备份目录：

```bash
mkdir -p backups
```

备份为 PostgreSQL custom dump：

```bash
docker compose exec -T db pg_dump \
  -U resource_pool \
  -d resource_pool \
  -Fc > backups/resource_pool_$(date +%F_%H%M%S).dump
```

如果你修改了 `.env` 中的 `POSTGRES_USER` 或 `POSTGRES_DB`，请同步替换命令中的用户名和库名。

## 数据库恢复

恢复前建议先备份当前库。

```bash
docker compose exec -T db pg_restore \
  -U resource_pool \
  -d resource_pool \
  --clean \
  --if-exists < backups/resource_pool_2026-06-02_120000.dump
```

恢复后重启应用：

```bash
docker compose restart app
```

## Docker 升级流程

推荐升级流程：

```bash
docker compose down
git pull
docker compose build
docker compose up -d
```

验收：

```bash
docker compose ps
docker compose logs -f app
```

由于数据库数据保存在 `resource_pool_postgres_data` volume 中，以上流程不会丢失：

- 用户
- 池子
- 资源
- 关联关系

## Ubuntu 22.04 VPS 准备

更新系统：

```bash
sudo apt update
sudo apt upgrade -y
```

安装基础工具：

```bash
sudo apt install -y ca-certificates curl gnupg nginx
```

安装 Docker：

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

允许当前用户运行 Docker：

```bash
sudo usermod -aG docker $USER
```

重新登录 SSH 后验证：

```bash
docker --version
docker compose version
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

## HTTPS 证书

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

验证自动续期：

```bash
sudo certbot renew --dry-run
```

## 常用运维命令

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
docker compose logs -f db
```

进入数据库：

```bash
docker compose exec db psql -U resource_pool -d resource_pool
```

手动执行迁移：

```bash
docker compose exec app npx prisma migrate deploy
```

重启服务：

```bash
docker compose restart app
```

## 部署验收清单

- `docker compose up -d --build` 可以启动 Web 与 PostgreSQL
- Web 服务可通过 `http://server-ip:3000` 访问
- Nginx 可通过域名反向代理到 Web 服务
- HTTPS 证书申请成功
- `docker compose down && docker compose up -d` 后数据仍存在
- `git pull && docker compose build && docker compose up -d` 后数据仍存在
- `npx prisma migrate deploy` 在应用容器启动时自动执行
