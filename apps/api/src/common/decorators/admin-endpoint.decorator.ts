import { applyDecorators, UseGuards } from "@nestjs/common";

import { ActiveUserGuard } from "../guards/active-user.guard";
import { AdminContextGuard } from "../guards/admin-context.guard";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

export function AdminEndpoint() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, ActiveUserGuard, AdminContextGuard, PermissionsGuard),
  );
}
