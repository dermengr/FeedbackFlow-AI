-- RBAC: Roles, Permissions, and the role/permission/user join tables.
--
-- This migration is written idempotently (IF NOT EXISTS / guarded
-- constraint additions) so it can be applied safely to:
--   * a fresh database (creates everything), and
--   * an existing database where the RBAC tables were previously
--     created via `prisma db push` (skips existing objects, only adds
--     the missing `api_keys.role_id` column + index + foreign key).

-- CreateTable
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_key" ON "permissions"("name");

-- AddColumn: optional RBAC role on API keys (inherits the role's permissions)
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "role_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_role_id_idx" ON "api_keys"("role_id");

-- AddForeignKey (guarded so existing constraints are not duplicated)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_roleId_fkey') THEN
        ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_permissionId_fkey') THEN
        ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey"
            FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_userId_fkey') THEN
        ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_roleId_fkey') THEN
        ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_role_id_fkey') THEN
        ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_role_id_fkey"
            FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
