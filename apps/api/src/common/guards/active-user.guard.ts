import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import { AUTH_CONTEXT } from "../auth.types";
import type { AuthenticatedRequest } from "../auth.types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.auth?.principal;

    if (!principal) {
      throw new UnauthorizedException("Authentication is required.");
    }

    const user =
      principal.context === AUTH_CONTEXT.gssAdmin
        ? await this.prisma.gssAdminUser.findUnique({ where: { id: principal.sub } })
        : await this.prisma.companyUser.findUnique({ where: { id: principal.sub } });

    if (!user || !user.isActive || user.tokenVersion !== principal.tokenVersion) {
      throw new UnauthorizedException(
        "The authenticated user is inactive or the session is revoked.",
      );
    }

    request.auth = { principal, user };
    return true;
  }
}
