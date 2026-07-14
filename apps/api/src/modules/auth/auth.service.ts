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
    email: string;
    id: string;
    isSuperAdmin: boolean;
    name: string;
    permissions: string[];
  };
}

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
    });

    await this.assertCredentials(user, login.password);
    const activeUser = user!;
    await this.prisma.gssAdminUser.update({
      where: { id: activeUser.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(AUTH_CONTEXT.gssAdmin, activeUser);
  }

  async loginCompany(login: LoginDto): Promise<AuthSessionResponse> {
    const user = await this.prisma.companyUser.findUnique({
      where: { email: login.email.toLowerCase() },
    });

    await this.assertCredentials(user, login.password);
    const activeUser = user!;
    await this.prisma.companyUser.update({
      where: { id: activeUser.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(AUTH_CONTEXT.companyUser, activeUser);
  }

  async getSession(context: AuthContext, userId: string): Promise<AuthSessionResponse> {
    const user =
      context === AUTH_CONTEXT.gssAdmin
        ? await this.prisma.gssAdminUser.findUnique({ where: { id: userId } })
        : await this.prisma.companyUser.findUnique({ where: { id: userId } });

    if (!user || !user.isActive) {
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

  private async createSession(
    context: AuthContext,
    user: {
      companyId?: string;
      email: string;
      id: string;
      name: string;
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
        email: user.email,
        id: user.id,
        isSuperAdmin: resolution.isSuperAdmin,
        name: user.name,
        permissions: [...resolution.permissions].sort(),
      },
    };
  }
}
