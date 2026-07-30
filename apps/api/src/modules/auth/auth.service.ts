import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { loadApiEnv } from "@gss-iot/config";

import { AUTH_CONTEXT } from "../../common/auth.types";
import type { AuthContext, AuthTokenPayload } from "../../common/auth.types";
import { PermissionResolverService } from "../rbac/permission-resolver.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";

export interface AuthSessionResponse {
  accessToken: string;
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

const roleSelect = {
  id: true,
  isSuperAdmin: true,
  key: true,
  name: true,
} as const;

const companyRoleSelect = {
  id: true,
  key: true,
  name: true,
} as const;

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

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PermissionResolverService)
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async loginGss(login: LoginDto): Promise<AuthSessionResponse> {
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

    return this.createSession(AUTH_CONTEXT.gssAdmin, activeUser);
  }

  async loginCompany(login: LoginDto): Promise<AuthSessionResponse> {
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

    return this.createSession(AUTH_CONTEXT.companyUser, activeUser);
  }

  async getSession(context: AuthContext, userId: string): Promise<AuthSessionResponse> {
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

    return this.createSession(context, user);
  }

  async logout(context: AuthContext, userId: string): Promise<void> {
    if (context === AUTH_CONTEXT.gssAdmin) {
      await this.prisma.gssAdminUser.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      return;
    }

    await this.prisma.companyUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
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

  private async createSession(
    context: AuthContext,
    user: {
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
    },
  ): Promise<AuthSessionResponse> {
    const resolution = await this.permissionResolver.resolve(context, user.id);
    const env = loadApiEnv();
    const payload: AuthTokenPayload = {
      context,
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      audience: context,
      expiresIn: env.JWT_EXPIRES_IN,
      secret: env.JWT_SECRET,
    });

    return {
      accessToken,
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
}
