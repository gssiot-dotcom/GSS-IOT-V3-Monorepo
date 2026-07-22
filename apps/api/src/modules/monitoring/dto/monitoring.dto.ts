import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class SensorHistoryQueryDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page?: number;

  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  pageSize?: number;
}

export class AdminMonitoringQueryDto {
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
