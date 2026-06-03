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
- 已关联对象 / 未关联对象双列表
- 未关联对象搜索、分页、单个关联、批量关联
- 全局搜索资源及其关联对象
- Docker Compose、Nginx、Let's Encrypt SSL 部署方案

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

3. 启动本地 PostgreSQL 容器：

```bash
docker compose up -d postgres
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
- `pool_items`：资源实体，业务数据存储在 PostgreSQL JSONB
- `relations`：任意两个资源之间的通用关联

字段类型：

```text
TEXT, PASSWORD, NUMBER, BOOLEAN, DATE, URL, EMAIL, PHONE, JSON
```

## 生产部署架构

生产环境统一采用 Docker Compose：

```text
VPS
Docker Engine
Docker Compose
Nginx
Let's Encrypt SSL
PostgreSQL Container
Next.js Container
```

数据库必须独立运行在 PostgreSQL 容器中。项目禁止使用 SQLite，禁止把数据库放在应用容器内部。

Docker Compose 服务结构：

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

## Docker Compose 部署

复制环境变量：

```bash
cp .env.example .env
```

修改 `.env`：

```text
JWT_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
POSTGRES_PASSWORD="replace-db-password"
```

启用 Docker 开机自启动：

```bash
sudo systemctl enable docker
```

标准启动命令：

```bash
docker compose up -d --build
```

应用容器启动时会自动执行 Prisma Migration：

```bash
npx prisma migrate deploy
```

首次部署后写入种子数据：

```bash
docker compose exec app npm run db:seed
```

访问：

```text
http://server-ip:3000
```

完整 VPS、Nginx、SSL、备份和恢复流程见 [docs/deployment.md](docs/deployment.md)。

## 数据安全说明

PostgreSQL 数据保存在 Docker Volume：

```text
postgres_data
```

下面操作不会删除数据库数据：

```bash
git pull
docker compose down
docker compose build
docker compose up -d
```

执行完成后，以下数据必须仍然存在：

- 用户数据
- 池子
- 资源
- 关联关系

不要执行下面命令，除非你明确要删除生产数据库：

```bash
docker compose down -v
docker volume rm postgres_data
```

## 生产环境更新代码

标准更新流程：

```bash
git pull
docker compose build
docker compose up -d
```

由于 PostgreSQL 使用 Docker Volume：

```text
postgres_data
```

因此更新代码、重建镜像、重启容器都不会重建数据库。

## 数据库备份与恢复

数据库备份：

```bash
docker compose exec postgres pg_dump -U postgres resource_pool > backup.sql
```

数据库恢复：

```bash
cat backup.sql | docker compose exec -T postgres psql -U postgres resource_pool
```

建议在每次生产更新前先备份数据库。

## 最终验收标准

场景 1：

```bash
docker compose down
docker compose up -d
```

结果：数据保留。

场景 2：

```bash
git pull
docker compose up -d --build
```

结果：数据保留。

场景 3：

```text
VPS 重启
Docker 自动启动
网站自动恢复
数据保留
```

结果：PostgreSQL 容器和 Next.js 容器自动恢复，用户、池子、资源、关联关系全部保留。

## 初始化 SQL

Prisma migration 位于：

```text
prisma/migrations/000001_init/migration.sql
```

可选 SQL 引导文件：

```text
prisma/init.sql
```

生产环境通过应用容器启动脚本自动执行：

```bash
npx prisma migrate deploy
```

## 后续扩展

新增资源池无需改代码：在 `/admin/pools` 创建池子并配置字段后，导航和资源录入页面会自动出现。通用关联表支持任意池子之间建立关系，例如平台与账号、账号与手机号、邮箱与代理、设备与 IP。
