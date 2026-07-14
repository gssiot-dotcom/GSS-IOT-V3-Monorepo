import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { AUTH_CONTEXT } from "../auth.types";
import type { AuthenticatedRequest } from "../auth.types";

@Injectable()
export class AdminContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.auth?.principal.context !== AUTH_CONTEXT.gssAdmin) {
      throw new ForbiddenException("A GSS admin context is required.");
    }

    return true;
  }
}
