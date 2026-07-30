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
        : await this.prisma.companyUser.findUnique({
            include: { company: { select: { deletedAt: true, status: true } } },
            where: { id: principal.sub },
          });
    const companyUserState = user as {
      company?: { deletedAt: Date | null; status: string };
      deletedAt?: Date | null;
    } | null;

    if (
      !user ||
      !user.isActive ||
      user.tokenVersion !== principal.tokenVersion ||
      Boolean(companyUserState?.deletedAt) ||
      Boolean(
        companyUserState?.company &&
        (companyUserState.company.status !== "ACTIVE" || companyUserState.company.deletedAt),
      )
    ) {
      throw new UnauthorizedException(
        "The authenticated user is inactive or the session is revoked.",
      );
    }

    request.auth = { principal, user };
    return true;
  }
}
