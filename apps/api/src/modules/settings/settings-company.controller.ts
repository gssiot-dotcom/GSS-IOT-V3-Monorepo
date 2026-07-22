import { Body, Controller, Get, Inject, Patch, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { UpdateCompanySettingsDto } from "./dto/company-settings.dto";
import { CompanySettingsService } from "./company-settings.service";

@CompanyEndpoint()
@Controller("company")
export class SettingsCompanyController {
  constructor(@Inject(CompanySettingsService) private readonly settings: CompanySettingsService) {}

  @RequirePermissions("settings.company.view")
  @Get("settings")
  getSettings(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    return this.settings.getForUser(auth!.principal.sub);
  }

  @RequirePermissions("settings.company.manage")
  @Patch("settings")
  updateSettings(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: UpdateCompanySettingsDto, transform: true }))
    dto: UpdateCompanySettingsDto,
  ) {
    return this.settings.updateForUser(auth!.principal, dto);
  }
}
