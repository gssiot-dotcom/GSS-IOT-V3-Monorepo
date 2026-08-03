CREATE TYPE "AuthSessionContext" AS ENUM ('gss-admin', 'company-user');

CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "context" "AuthSessionContext" NOT NULL,
    "familyId" UUID NOT NULL,
    "currentJti" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "gssAdminUserId" UUID,
    "companyUserId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "replacedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RefreshSession_exactly_one_principal_check" CHECK (
      (("gssAdminUserId" IS NOT NULL)::integer + ("companyUserId" IS NOT NULL)::integer) = 1
    )
);

CREATE UNIQUE INDEX "RefreshSession_currentJti_key" ON "RefreshSession"("currentJti");
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE UNIQUE INDEX "RefreshSession_replacedById_key" ON "RefreshSession"("replacedById");
CREATE INDEX "RefreshSession_familyId_revokedAt_idx" ON "RefreshSession"("familyId", "revokedAt");
CREATE INDEX "RefreshSession_gssAdminUserId_revokedAt_expiresAt_idx" ON "RefreshSession"("gssAdminUserId", "revokedAt", "expiresAt");
CREATE INDEX "RefreshSession_companyUserId_revokedAt_expiresAt_idx" ON "RefreshSession"("companyUserId", "revokedAt", "expiresAt");
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");

ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_replacedById_fkey"
  FOREIGN KEY ("replacedById") REFERENCES "RefreshSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_gssAdminUserId_fkey"
  FOREIGN KEY ("gssAdminUserId") REFERENCES "GssAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_companyUserId_fkey"
  FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
