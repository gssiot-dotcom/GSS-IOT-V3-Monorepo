import { IsIn, IsOptional } from "class-validator";

import type { DashboardRange } from "@gss-iot/contracts";

export class DashboardSummaryQueryDto {
  @IsIn(["7d", "30d", "90d"])
  @IsOptional()
  range: DashboardRange = "7d";
}
