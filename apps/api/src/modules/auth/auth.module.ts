import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { ActiveUserGuard } from "../../common/guards/active-user.guard";
import { AdminContextGuard } from "../../common/guards/admin-context.guard";
import { CompanyContextGuard } from "../../common/guards/company-context.guard";
import { CompanyScopeGuard } from "../../common/guards/company-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RbacModule } from "../rbac/rbac.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [JwtModule.register({}), RbacModule],
  controllers: [AuthController],
  providers: [
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
