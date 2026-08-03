import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { loadApiEnv } from "@gss-iot/config";

import { AUTH_CONTEXT } from "../auth.types";
import type { AuthenticatedRequest, AuthTokenPayload } from "../auth.types";
import { AuthCookieService } from "../../modules/auth/auth-cookie.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.accessToken(request.headers.cookie);

    if (!token) {
      throw new UnauthorizedException("An access cookie is required.");
    }

    try {
      const env = loadApiEnv();
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });

      if (
        !payload.sub ||
        !payload.tokenVersion?.toString() ||
        payload.typ !== "access" ||
        payload.context !== payload.aud ||
        !Object.values(AUTH_CONTEXT).includes(payload.context)
      ) {
        throw new UnauthorizedException("The token context is invalid.");
      }

      request.auth = { principal: payload };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("The access cookie is invalid or expired.");
    }
  }
}
