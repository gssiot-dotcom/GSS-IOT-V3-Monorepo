import { Type } from "class-transformer";
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ReportFileFormat, ReportJobStatus, ReportType } from "@prisma/client";

export class ReportFiltersDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @IsUUID()
  gatewayId?: string;

  @IsOptional()
  @IsUUID()
  nodeTypeId?: string;

  @IsOptional()
  @IsUUID()
  nodeId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class RequestReportExportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsEnum(ReportFileFormat)
  format!: ReportFileFormat;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFiltersDto)
  filters?: ReportFiltersDto;
}

export class ListReportJobsQueryDto {
  @IsOptional()
  @IsEnum(ReportJobStatus)
  status?: ReportJobStatus;

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
