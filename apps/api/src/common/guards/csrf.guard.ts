import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { loadApiEnv, type ApiEnv } from "@gss-iot/config";

import { AuthCookieService } from "../../modules/auth/auth-cookie.service";

type CsrfRequest = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly env: ApiEnv;

  constructor(
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
    @Inject("AUTH_API_ENV") env?: ApiEnv,
  ) {
    this.env = env ?? loadApiEnv();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    this.assertTrustedOrigin(request);
    const cookie = this.cookies.csrfToken(this.header(request, "cookie"));
    const header = this.header(request, "x-csrf-token");
    if (!cookie || !header || !this.equal(cookie, header)) {
      throw new ForbiddenException("The CSRF token is missing or invalid.");
    }
    return true;
  }

  private assertTrustedOrigin(request: CsrfRequest): void {
    const origin = this.header(request, "origin");
    const referer = this.header(request, "referer");
    let candidate = origin;
    if (!candidate && referer) {
      try {
        candidate = new URL(referer).origin;
      } catch {
        throw new ForbiddenException("The request origin is invalid.");
      }
    }
    if (candidate && !this.env.CORS_ALLOWED_ORIGINS.includes(candidate)) {
      throw new ForbiddenException("The request origin is not allowed.");
    }
  }

  private header(request: CsrfRequest, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private equal(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
