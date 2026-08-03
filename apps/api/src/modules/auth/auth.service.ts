import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthSessionContext } from "@prisma/client";
import { compare } from "bcrypt";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { loadApiEnv } from "@gss-iot/config";

import { AUTH_CONTEXT } from "../../common/auth.types";
import type { AuthContext, AuthTokenPayload, RefreshTokenPayload } from "../../common/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import type { LoginDto } from "./dto/login.dto";

export interface AuthSessionResponse {
  context: AuthContext;
  user: {
    companyId?: string;
    company?: { id: string; name: string } | null;
    email: string;
    id: string;
    isActive: boolean;
    isSuperAdmin: boolean;
    lastLoginAt: string | null;
    name: string;
    phone: string | null;
    permissions: string[];
    role: { id: string; isSuperAdmin: boolean; key: string; name: string } | null;
  };
}

export interface AuthenticatedSessionResult {
  accessToken: string;
  refreshToken: string;
  session: AuthSessionResponse;
}

const roleSelect = { id: true, isSuperAdmin: true, key: true, name: true } as const;
const companyRoleSelect = { id: true, key: true, name: true } as const;
const gssUserSelect = {
  email: true,
  id: true,
  isActive: true,
  lastLoginAt: true,
  name: true,
  passwordHash: true,
  phone: true,
  role: { select: roleSelect },
  tokenVersion: true,
} as const;
const companyUserSelect = {
  company: { select: { deletedAt: true, id: true, name: true, status: true } },
  companyId: true,
  deletedAt: true,
  email: true,
  id: true,
  isActive: true,
  lastLoginAt: true,
  name: true,
  passwordHash: true,
  phone: true,
  role: { select: companyRoleSelect },
  tokenVersion: true,
} as const;

type SessionUser = {
  companyId?: string;
  company?: {
    deletedAt?: Date | null;
    id: string;
    name: string;
    status?: "ACTIVE" | "INACTIVE";
  } | null;
  deletedAt?: Date | null;
  email: string;
  id: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  name: string;
  phone: string | null;
  role: { id: string; isSuperAdmin?: boolean; key: string; name: string };
  tokenVersion: number;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async loginGss(login: LoginDto): Promise<AuthenticatedSessionResult> {
    const user = await this.prisma.gssAdminUser.findUnique({
      where: { email: login.email.toLowerCase() },
      select: gssUserSelect,
    });
    await this.assertCredentials(user, login.password);
    const activeUser = user!;
    const loginAt = new Date();
    await this.prisma.gssAdminUser.update({
      where: { id: activeUser.id },
      data: { lastLoginAt: loginAt },
    });
    activeUser.lastLoginAt = loginAt;
    return this.createAuthenticatedSession(AUTH_CONTEXT.gssAdmin, activeUser);
  }

  async loginCompany(login: LoginDto): Promise<AuthenticatedSessionResult> {
    const user = await this.prisma.companyUser.findUnique({
      where: { email: login.email.toLowerCase() },
      select: companyUserSelect,
    });
    await this.assertCompanyCredentials(user, login.password);
    const activeUser = user!;
    const loginAt = new Date();
    await this.prisma.companyUser.update({
      where: { id: activeUser.id },
      data: { lastLoginAt: loginAt },
    });
    activeUser.lastLoginAt = loginAt;
    return this.createAuthenticatedSession(AUTH_CONTEXT.companyUser, activeUser);
  }

  async refresh(rawRefreshToken: string): Promise<AuthenticatedSessionResult> {
    const env = loadApiEnv();
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException("The refresh token is invalid or expired.");
    }
    if (
      payload.typ !== "refresh" ||
      !payload.sub ||
      !payload.sessionId ||
      !payload.familyId ||
      !payload.jti ||
      payload.aud !== `${payload.context}:refresh` ||
      !Object.values(AUTH_CONTEXT).includes(payload.context)
    ) {
      throw new UnauthorizedException("The refresh token context is invalid.");
    }

    const nextSessionId = randomUUID();
    const nextJti = randomUUID();
    const now = new Date();
    const tokenHash = this.hashToken(rawRefreshToken);

    const rotation = await this.prisma.$transaction(async (tx) => {
      const current = await tx.refreshSession.findUnique({ where: { id: payload.sessionId } });
      const tokenMatches = Boolean(current && this.hashesEqual(current.tokenHash, tokenHash));
      if (
        !current ||
        !tokenMatches ||
        current.familyId !== payload.familyId ||
        current.currentJti !== payload.jti ||
        current.revokedAt ||
        current.replacedById ||
        current.expiresAt <= now
      ) {
        if (current?.familyId) {
          await tx.refreshSession.updateMany({
            data: { revokedAt: now, revokeReason: "REUSE_DETECTED" },
            where: { familyId: current.familyId, revokedAt: null },
          });
        }
        return { rotated: false as const };
      }

      const claimed = await tx.refreshSession.updateMany({
        data: { lastUsedAt: now, revokedAt: now, revokeReason: "ROTATED" },
        where: { id: current.id, replacedById: null, revokedAt: null },
      });
      if (claimed.count !== 1) {
        await tx.refreshSession.updateMany({
          data: { revokedAt: now, revokeReason: "REUSE_DETECTED" },
          where: { familyId: current.familyId, revokedAt: null },
        });
        return { rotated: false as const };
      }

      const remainingSeconds = Math.max(
        1,
        Math.ceil((current.expiresAt.getTime() - now.getTime()) / 1_000),
      );
      const nextRefreshToken = await this.signRefreshToken(
        {
          context: payload.context,
          familyId: payload.familyId,
          jti: nextJti,
          sessionId: nextSessionId,
          sub: payload.sub,
          tokenVersion: payload.tokenVersion,
        },
        remainingSeconds,
      );

      await tx.refreshSession.create({
        data: {
          companyUserId: payload.context === AUTH_CONTEXT.companyUser ? payload.sub : undefined,
          context: this.sessionContext(payload.context),
          currentJti: nextJti,
          expiresAt: current.expiresAt,
          familyId: current.familyId,
          gssAdminUserId: payload.context === AUTH_CONTEXT.gssAdmin ? payload.sub : undefined,
          id: nextSessionId,
          tokenHash: this.hashToken(nextRefreshToken),
          tokenVersion: payload.tokenVersion,
        },
      });
      await tx.refreshSession.update({
        data: { replacedById: nextSessionId },
        where: { id: current.id },
      });
      return { refreshToken: nextRefreshToken, rotated: true as const };
    });

    if (!rotation.rotated) {
      throw new UnauthorizedException("Refresh token reuse was detected.");
    }
    let user: SessionUser;
    try {
      user = await this.getSessionUser(payload.context, payload.sub);
    } catch (error) {
      await this.revokeFamily(payload.familyId, "USER_UNAVAILABLE");
      throw error;
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      await this.revokeFamily(payload.familyId, "TOKEN_VERSION_CHANGED");
      throw new UnauthorizedException("The session has been revoked.");
    }
    return {
      accessToken: await this.signAccessToken(payload.context, user),
      refreshToken: rotation.refreshToken,
      session: await this.publicSession(payload.context, user),
    };
  }

  async getSession(context: AuthContext, userId: string): Promise<AuthSessionResponse> {
    return this.publicSession(context, await this.getSessionUser(context, userId));
  }

  async logout(context: AuthContext, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (context === AUTH_CONTEXT.gssAdmin) {
        await tx.gssAdminUser.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        });
        await tx.refreshSession.updateMany({
          data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
          where: { gssAdminUserId: userId, revokedAt: null },
        });
      } else {
        await tx.companyUser.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        });
        await tx.refreshSession.updateMany({
          data: { revokedAt: new Date(), revokeReason: "LOGOUT" },
          where: { companyUserId: userId, revokedAt: null },
        });
      }
    });
  }

  private async createAuthenticatedSession(
    context: AuthContext,
    user: SessionUser,
  ): Promise<AuthenticatedSessionResult> {
    const env = loadApiEnv();
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const jti = randomUUID();
    const refreshToken = await this.signRefreshToken({
      context,
      familyId,
      jti,
      sessionId,
      sub: user.id,
      tokenVersion: user.tokenVersion,
    });
    await this.prisma.refreshSession.create({
      data: {
        companyUserId: context === AUTH_CONTEXT.companyUser ? user.id : undefined,
        context: this.sessionContext(context),
        currentJti: jti,
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN * 1_000),
        familyId,
        gssAdminUserId: context === AUTH_CONTEXT.gssAdmin ? user.id : undefined,
        id: sessionId,
        tokenHash: this.hashToken(refreshToken),
        tokenVersion: user.tokenVersion,
      },
    });
    return {
      accessToken: await this.signAccessToken(context, user),
      refreshToken,
      session: await this.publicSession(context, user),
    };
  }

  private async getSessionUser(context: AuthContext, userId: string): Promise<SessionUser> {
    const user =
      context === AUTH_CONTEXT.gssAdmin
        ? await this.prisma.gssAdminUser.findUnique({
            where: { id: userId },
            select: gssUserSelect,
          })
        : await this.prisma.companyUser.findUnique({
            where: { id: userId },
            select: companyUserSelect,
          });
    if (
      !user ||
      !user.isActive ||
      ("deletedAt" in user && user.deletedAt) ||
      ("company" in user && (user.company.status !== "ACTIVE" || user.company.deletedAt))
    ) {
      throw new UnauthorizedException("The user is inactive or unavailable.");
    }
    return user;
  }

  private async publicSession(
    context: AuthContext,
    user: SessionUser,
  ): Promise<AuthSessionResponse> {
    const resolution = await this.permissionResolver.resolve(context, user.id);
    return {
      context,
      user: {
        ...(user.companyId ? { companyId: user.companyId } : {}),
        company: user.company ?? null,
        email: user.email,
        id: user.id,
        isActive: user.isActive,
        isSuperAdmin: resolution.isSuperAdmin,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        name: user.name,
        phone: user.phone,
        permissions: [...resolution.permissions].sort(),
        role: { ...user.role, isSuperAdmin: user.role.isSuperAdmin ?? false },
      },
    };
  }

  private signAccessToken(context: AuthContext, user: SessionUser): Promise<string> {
    const env = loadApiEnv();
    const payload: AuthTokenPayload = {
      context,
      sub: user.id,
      tokenVersion: user.tokenVersion,
      typ: "access",
    };
    return this.jwtService.signAsync(payload, {
      audience: context,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      secret: env.JWT_ACCESS_SECRET,
    });
  }

  private signRefreshToken(
    payload: Omit<RefreshTokenPayload, "aud" | "typ">,
    expiresIn?: number,
  ): Promise<string> {
    const env = loadApiEnv();
    return this.jwtService.signAsync(
      { ...payload, typ: "refresh" } satisfies Omit<RefreshTokenPayload, "aud">,
      {
        audience: `${payload.context}:refresh`,
        expiresIn: expiresIn ?? env.JWT_REFRESH_EXPIRES_IN,
        secret: env.JWT_REFRESH_SECRET,
      },
    );
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      data: { revokedAt: new Date(), revokeReason: reason },
      where: { familyId, revokedAt: null },
    });
  }

  private sessionContext(context: AuthContext): AuthSessionContext {
    return context === AUTH_CONTEXT.gssAdmin
      ? AuthSessionContext.GSS_ADMIN
      : AuthSessionContext.COMPANY_USER;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashesEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private async assertCredentials(
    user: { isActive: boolean; passwordHash: string } | null,
    password: string,
  ): Promise<void> {
    if (!user || !user.isActive || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("The email or password is invalid.");
    }
  }

  private async assertCompanyCredentials(
    user: {
      company: { deletedAt: Date | null; status: "ACTIVE" | "INACTIVE" };
      deletedAt: Date | null;
      isActive: boolean;
      passwordHash: string;
    } | null,
    password: string,
  ): Promise<void> {
    if (
      !user ||
      !user.isActive ||
      user.deletedAt ||
      user.company.status !== "ACTIVE" ||
      user.company.deletedAt ||
      !(await compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException("The email or password is invalid.");
    }
  }
}
