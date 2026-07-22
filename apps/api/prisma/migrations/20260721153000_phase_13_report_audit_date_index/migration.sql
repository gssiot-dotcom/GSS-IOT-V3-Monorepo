-- Forward-only Phase 13 index for bounded audit report date queries.
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
