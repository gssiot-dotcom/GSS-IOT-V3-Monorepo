import { applyDecorators, UseGuards } from "@nestjs/common";

import { ActiveUserGuard } from "../guards/active-user.guard";
import { CompanyContextGuard } from "../guards/company-context.guard";
import { CompanyScopeGuard } from "../guards/company-scope.guard";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

export function CompanyEndpoint() {
  return applyDecorators(
    UseGuards(
      JwtAuthGuard,
      ActiveUserGuard,
      CompanyContextGuard,
      PermissionsGuard,
      CompanyScopeGuard,
    ),
  );
}
