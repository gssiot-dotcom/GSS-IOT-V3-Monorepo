import { Controller, Get, Inject, Query, ValidationPipe } from "@nestjs/common";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { DashboardService } from "./dashboard.service";
import { DashboardSummaryQueryDto } from "./dto/dashboard.dto";

@CompanyEndpoint()
@Controller("company/dashboard")
export class DashboardCompanyController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get("summary")
  @RequirePermissions("dashboard.view")
  getSummary(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Query(new ValidationPipe({ expectedType: DashboardSummaryQueryDto, transform: true }))
    query: DashboardSummaryQueryDto,
  ) {
    return this.dashboard.getSummary(auth!.principal, query.range);
  }
}
