import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { loadApiEnv } from "@gss-iot/config";

import { ActiveUserGuard } from "../../common/guards/active-user.guard";
import { AdminContextGuard } from "../../common/guards/admin-context.guard";
import { CompanyContextGuard } from "../../common/guards/company-context.guard";
import { CompanyScopeGuard } from "../../common/guards/company-scope.guard";
import { CsrfGuard } from "../../common/guards/csrf.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RbacModule } from "../rbac/rbac.module";

import { AuthController } from "./auth.controller";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthService } from "./auth.service";

@Module({
  imports: [JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [
    { provide: "AUTH_API_ENV", useFactory: loadApiEnv },
    { provide: APP_GUARD, useClass: CsrfGuard },
    AuthCookieService,
    AuthService,
    JwtAuthGuard,
    ActiveUserGuard,
    AdminContextGuard,
    CompanyContextGuard,
    PermissionsGuard,
    CompanyScopeGuard,
  ],
  exports: [
    AuthService,
    AuthCookieService,
    RbacModule,
    JwtModule,
    JwtAuthGuard,
    ActiveUserGuard,
    AdminContextGuard,
    CompanyContextGuard,
    PermissionsGuard,
    CompanyScopeGuard,
  ],
})
export class AuthModule {}
