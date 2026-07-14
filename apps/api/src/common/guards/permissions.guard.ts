import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "../auth.types";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { PermissionResolverService } from "../../modules/rbac/permission-resolver.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.auth?.principal;

    if (!principal) {
      throw new ForbiddenException("An authenticated principal is required.");
    }

    const permitted = await Promise.all(
      requiredPermissions.map((permission) =>
        this.permissionResolver.hasPermission(principal.context, principal.sub, permission),
      ),
    );

    if (permitted.every(Boolean)) {
      return true;
    }

    throw new ForbiddenException("The required permission is missing.");
  }
}
