-- CreateEnum
CREATE TYPE "PermissionScopeType" AS ENUM ('GSS', 'COMPANY', 'BOTH');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('VIEW', 'MANAGE');

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scopeType" "PermissionScopeType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GssRole" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GssRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GssAdminUser" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GssAdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GssRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    CONSTRAINT "GssRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "GssAdminUserPermission" (
    "adminUserId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    CONSTRAINT "GssAdminUserPermission_pkey" PRIMARY KEY ("adminUserId","permissionId")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionArea" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConstructionArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionBuilding" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConstructionBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRole" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isCompanyOwnerRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    CONSTRAINT "CompanyRolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "CompanyUserPermission" (
    "companyUserId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    CONSTRAINT "CompanyUserPermission_pkey" PRIMARY KEY ("companyUserId","permissionId")
);

-- CreateTable
CREATE TABLE "CompanyUserAreaAccess" (
    "companyUserId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'VIEW',
    CONSTRAINT "CompanyUserAreaAccess_pkey" PRIMARY KEY ("companyUserId","areaId")
);

-- CreateTable
CREATE TABLE "CompanyUserBuildingAccess" (
    "companyUserId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'VIEW',
    CONSTRAINT "CompanyUserBuildingAccess_pkey" PRIMARY KEY ("companyUserId","buildingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE UNIQUE INDEX "GssRole_key_key" ON "GssRole"("key");
CREATE UNIQUE INDEX "GssAdminUser_email_key" ON "GssAdminUser"("email");
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");
CREATE UNIQUE INDEX "ConstructionArea_companyId_name_key" ON "ConstructionArea"("companyId", "name");
CREATE UNIQUE INDEX "ConstructionBuilding_areaId_title_key" ON "ConstructionBuilding"("areaId", "title");
CREATE UNIQUE INDEX "CompanyRole_companyId_key_key" ON "CompanyRole"("companyId", "key");
CREATE UNIQUE INDEX "CompanyUser_email_key" ON "CompanyUser"("email");

-- AddForeignKey
ALTER TABLE "GssAdminUser" ADD CONSTRAINT "GssAdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "GssRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GssRolePermission" ADD CONSTRAINT "GssRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "GssRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GssRolePermission" ADD CONSTRAINT "GssRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GssAdminUserPermission" ADD CONSTRAINT "GssAdminUserPermission_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "GssAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GssAdminUserPermission" ADD CONSTRAINT "GssAdminUserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionArea" ADD CONSTRAINT "ConstructionArea_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionBuilding" ADD CONSTRAINT "ConstructionBuilding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionBuilding" ADD CONSTRAINT "ConstructionBuilding_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyRole" ADD CONSTRAINT "CompanyRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyRolePermission" ADD CONSTRAINT "CompanyRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CompanyRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyRolePermission" ADD CONSTRAINT "CompanyRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserPermission" ADD CONSTRAINT "CompanyUserPermission_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserPermission" ADD CONSTRAINT "CompanyUserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserAreaAccess" ADD CONSTRAINT "CompanyUserAreaAccess_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserAreaAccess" ADD CONSTRAINT "CompanyUserAreaAccess_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ConstructionArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserBuildingAccess" ADD CONSTRAINT "CompanyUserBuildingAccess_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUserBuildingAccess" ADD CONSTRAINT "CompanyUserBuildingAccess_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "ConstructionBuilding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
