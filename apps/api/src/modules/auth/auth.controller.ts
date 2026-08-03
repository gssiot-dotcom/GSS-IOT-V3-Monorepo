import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";

import { AUTH_CONTEXT } from "../../common/auth.types";
import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { ActiveUserGuard } from "../../common/guards/active-user.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { AuthCookieService, type CookieResponse } from "./auth-cookie.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
  ) {}

  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: CookieResponse) {
    return { csrfToken: this.cookies.issueCsrf(response) };
  }

  @Post("gss/login")
  async loginGss(
    @Body(new ValidationPipe({ expectedType: LoginDto, transform: true })) login: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.authService.loginGss(login);
    this.cookies.setSessionCookies(response, result.accessToken, result.refreshToken);
    return result.session;
  }

  @Post("company/login")
  async loginCompany(
    @Body(new ValidationPipe({ expectedType: LoginDto, transform: true })) login: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const result = await this.authService.loginCompany(login);
    this.cookies.setSessionCookies(response, result.accessToken, result.refreshToken);
    return result.session;
  }

  @Post("refresh")
  async refresh(
    @Req() request: { headers: { cookie?: string } },
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const refreshToken = this.cookies.refreshToken(request.headers.cookie);
    if (!refreshToken) {
      this.cookies.clearSessionCookies(response);
      throw new UnauthorizedException("A refresh cookie is required.");
    }
    try {
      const result = await this.authService.refresh(refreshToken);
      this.cookies.setSessionCookies(response, result.accessToken, result.refreshToken);
      this.cookies.issueCsrf(response);
      return result.session;
    } catch (error) {
      this.cookies.clearSessionCookies(response);
      throw error;
    }
  }

  @AdminEndpoint()
  @Get("gss/me")
  async getGssMe(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.authService.getSession(AUTH_CONTEXT.gssAdmin, auth!.principal.sub);
  }

  @CompanyEndpoint()
  @Get("company/me")
  async getCompanyMe(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.authService.getSession(AUTH_CONTEXT.companyUser, auth!.principal.sub);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @HttpCode(204)
  @Post("logout")
  async logout(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.authService.logout(auth!.principal.context, auth!.principal.sub);
    this.cookies.clearSessionCookies(response);
  }
}
