-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'PASSWORD', 'NUMBER', 'BOOLEAN', 'DATE', 'URL', 'EMAIL', 'PHONE', 'JSON');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_fields" (
    "id" SERIAL NOT NULL,
    "pool_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "label" TEXT,
    "field_type" "FieldType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "unique" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_items" (
    "id" SERIAL NOT NULL,
    "pool_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relations" (
    "id" SERIAL NOT NULL,
    "source_pool_id" INTEGER NOT NULL,
    "source_item_id" INTEGER NOT NULL,
    "target_pool_id" INTEGER NOT NULL,
    "target_item_id" INTEGER NOT NULL,
    "note" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "pools_name_key" ON "pools"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pools_slug_key" ON "pools"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pool_fields_pool_id_field_name_key" ON "pool_fields"("pool_id", "field_name");

-- CreateIndex
CREATE INDEX "pool_items_pool_id_idx" ON "pool_items"("pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "relations_source_pool_id_source_item_id_target_pool_id_target_item_id_key" ON "relations"("source_pool_id", "source_item_id", "target_pool_id", "target_item_id");

-- CreateIndex
CREATE INDEX "relations_source_pool_id_source_item_id_idx" ON "relations"("source_pool_id", "source_item_id");

-- CreateIndex
CREATE INDEX "relations_target_pool_id_target_item_id_idx" ON "relations"("target_pool_id", "target_item_id");

-- AddForeignKey
ALTER TABLE "pool_fields" ADD CONSTRAINT "pool_fields_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_items" ADD CONSTRAINT "pool_items_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_pool_id_fkey" FOREIGN KEY ("source_pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "pool_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_pool_id_fkey" FOREIGN KEY ("target_pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_item_id_fkey" FOREIGN KEY ("target_item_id") REFERENCES "pool_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relations" ADD CONSTRAINT "relations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
