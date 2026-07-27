import { Transform } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, Min } from "class-validator";

export class SensorHistoryRangeQueryDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;
}

export class SensorHistoryQueryDto extends SensorHistoryRangeQueryDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page = 1;

  @IsInt()
  @IsOptional()
  @IsIn([50, 100])
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  pageSize: 50 | 100 = 50;
}

export class SensorHistoryChartQueryDto extends SensorHistoryRangeQueryDto {}

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
