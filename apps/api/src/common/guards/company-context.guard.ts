import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { AUTH_CONTEXT } from "../auth.types";
import type { AuthenticatedRequest } from "../auth.types";

@Injectable()
export class CompanyContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.auth?.principal.context !== AUTH_CONTEXT.companyUser) {
      throw new ForbiddenException("A company user context is required.");
    }

    return true;
  }
}
