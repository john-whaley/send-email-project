# 资源池管理平台

基于 Next.js 15、TypeScript、Prisma、PostgreSQL、TailwindCSS 和 Shadcn UI 风格组件的动态资源池管理系统。

## 功能

- JWT Cookie 登录认证
- Admin/User RBAC 权限
- 动态创建资源池
- 动态字段配置
- 资源新增、编辑、删除、搜索
- CSV、XLS、XLSX 批量导入
- 任意资源池之间的通用关联关系
- 主池/副池双向关联查询
- 全局搜索资源及其关联对象
- Docker、VPS、Nginx、PM2 部署文件

## 技术栈

- Next.js 15 App Router
- TypeScript
- Prisma ORM
- PostgreSQL JSONB
- TailwindCSS
- Shadcn UI 风格本地组件
- bcryptjs
- jsonwebtoken

## 本地开发

1. 安装依赖：

```bash
npm install
```

2. 创建环境变量：

```bash
cp .env.example .env
```

3. 启动 PostgreSQL：

```bash
docker compose up -d db
```

4. 执行迁移和种子数据：

```bash
npx prisma migrate dev
npm run db:seed
```

5. 启动开发服务器：

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

初始账号：

```text
管理员：admin / admin123456
查询用户：viewer / user123456
```

## 主要页面

```text
/login             登录
/dashboard         总览
/pools/[poolId]    某个资源池
/relations         主池/副池关联查询
/search            全局搜索
/admin/pools       池子和字段管理
/admin/resources   资源管理与批量导入
/settings          用户中心
```

## 数据模型

核心表：

- `users`：用户与角色
- `pools`：资源池类型
- `pool_fields`：动态字段配置
- `pool_items`：资源实体，业务数据存储在 JSONB
- `relations`：任意两个资源之间的通用关联

字段类型：

```text
TEXT, PASSWORD, NUMBER, BOOLEAN, DATE, URL, EMAIL, PHONE, JSON
```

## Docker 部署

复制 `.env.example` 为 `.env`，修改 `JWT_SECRET`、`NEXTAUTH_SECRET` 和数据库密码，然后启动：

```bash
docker compose up -d --build
```

首次启动后写入种子数据：

```bash
docker compose exec app npm run db:seed
```

Docker 启动时会自动执行 Prisma Migration：

```bash
npx prisma migrate deploy
```

PostgreSQL 使用独立容器和命名 volume：

```text
resource_pool_postgres_data
```

只执行 `docker compose down`、`docker compose build`、`docker compose up -d` 不会删除数据库数据。完整 VPS、Nginx、SSL、备份和恢复流程见 [docs/deployment.md](docs/deployment.md)。

## VPS + PM2 部署

1. 安装 Node.js 22、PostgreSQL、Nginx、PM2。

2. 创建数据库：

```bash
sudo -u postgres psql
CREATE USER resource_pool WITH PASSWORD 'replace-db-password';
CREATE DATABASE resource_pool OWNER resource_pool;
\q
```

3. 配置 `.env`：

```text
DATABASE_URL="postgresql://resource_pool:replace-db-password@127.0.0.1:5432/resource_pool?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_NAME="资源池管理平台"
```

4. 构建并迁移：

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run build
```

5. 使用 PM2 启动：

```bash
pm2 start npm --name resource-pool -- start
pm2 save
pm2 startup
```

6. Nginx：

将 `deploy/nginx.conf` 复制到 `/etc/nginx/sites-available/resource-pool`，替换域名后启用：

```bash
sudo ln -s /etc/nginx/sites-available/resource-pool /etc/nginx/sites-enabled/resource-pool
sudo nginx -t
sudo systemctl reload nginx
```

7. HTTPS：

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 初始化 SQL

Prisma migration 位于：

```text
prisma/migrations/000001_init/migration.sql
```

可选 SQL 引导文件：

```text
prisma/init.sql
```

推荐生产环境使用：

```bash
npx prisma migrate deploy
```

## 后续扩展

新增资源池无需改代码：在 `/admin/pools` 创建池子并配置字段后，导航和资源录入页面会自动出现。通用关联表支持任意池子之间建立关系，例如平台与账号、账号与手机号、邮箱与代理、设备与 IP。
