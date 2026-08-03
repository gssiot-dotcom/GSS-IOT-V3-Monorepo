import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { loadApiEnv, type ApiEnv } from "@gss-iot/config";

export interface CookieResponse {
  clearCookie(name: string, options: AuthCookieOptions): void;
  cookie(name: string, value: string, options: AuthCookieOptions): void;
}

export interface AuthCookieOptions {
  domain?: string;
  httpOnly?: boolean;
  maxAge?: number;
  path: string;
  sameSite: "lax" | "none" | "strict";
  secure: boolean;
}

export function parseCookies(header: string | undefined): Readonly<Record<string, string>> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 1) return [];
      const name = entry.slice(0, separator).trim();
      const rawValue = entry.slice(separator + 1).trim();
      try {
        return [[name, decodeURIComponent(rawValue)]];
      } catch {
        return [];
      }
    }),
  );
}

@Injectable()
export class AuthCookieService {
  private readonly env: ApiEnv;

  constructor(@Inject("AUTH_API_ENV") env?: ApiEnv) {
    this.env = env ?? loadApiEnv();
  }

  accessToken(cookieHeader: string | undefined): string | undefined {
    return parseCookies(cookieHeader)[this.env.AUTH_ACCESS_COOKIE_NAME];
  }

  refreshToken(cookieHeader: string | undefined): string | undefined {
    return parseCookies(cookieHeader)[this.env.AUTH_REFRESH_COOKIE_NAME];
  }

  csrfToken(cookieHeader: string | undefined): string | undefined {
    return parseCookies(cookieHeader)[this.env.AUTH_CSRF_COOKIE_NAME];
  }

  issueCsrf(response: CookieResponse): string {
    const token = randomBytes(32).toString("base64url");
    response.cookie(this.env.AUTH_CSRF_COOKIE_NAME, token, this.options(false, "/"));
    return token;
  }

  setSessionCookies(response: CookieResponse, accessToken: string, refreshToken: string): void {
    response.cookie(
      this.env.AUTH_ACCESS_COOKIE_NAME,
      accessToken,
      this.options(true, "/", this.env.JWT_ACCESS_EXPIRES_IN * 1_000),
    );
    response.cookie(
      this.env.AUTH_REFRESH_COOKIE_NAME,
      refreshToken,
      this.options(true, "/auth", this.env.JWT_REFRESH_EXPIRES_IN * 1_000),
    );
  }

  clearSessionCookies(response: CookieResponse): void {
    response.clearCookie(this.env.AUTH_ACCESS_COOKIE_NAME, this.options(true, "/"));
    response.clearCookie(this.env.AUTH_REFRESH_COOKIE_NAME, this.options(true, "/auth"));
    response.clearCookie(this.env.AUTH_CSRF_COOKIE_NAME, this.options(false, "/"));
  }

  private options(httpOnly: boolean, path: string, maxAge?: number): AuthCookieOptions {
    return {
      ...(this.env.AUTH_COOKIE_DOMAIN ? { domain: this.env.AUTH_COOKIE_DOMAIN } : {}),
      httpOnly,
      ...(maxAge ? { maxAge } : {}),
      path,
      sameSite: this.env.AUTH_COOKIE_SAME_SITE,
      secure: this.env.AUTH_COOKIE_SECURE,
    };
  }
}
