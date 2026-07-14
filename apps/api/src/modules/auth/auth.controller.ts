import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
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
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("gss/login")
  async loginGss(
    @Body(new ValidationPipe({ expectedType: LoginDto, transform: true })) login: LoginDto,
  ) {
    return this.authService.loginGss(login);
  }

  @Post("company/login")
  async loginCompany(
    @Body(new ValidationPipe({ expectedType: LoginDto, transform: true })) login: LoginDto,
  ) {
    return this.authService.loginCompany(login);
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
  async logout(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]): Promise<void> {
    await this.authService.logout(auth!.principal.context, auth!.principal.sub);
  }
}
