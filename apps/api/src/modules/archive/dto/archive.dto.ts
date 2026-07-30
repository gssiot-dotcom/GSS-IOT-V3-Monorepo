import { ArchiveEntityType, SensorReadingStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsBoolean,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

import { PaginationQueryDto } from "../../../common/dto/pagination.dto";

export class ListArchiveQueryDto extends PaginationQueryDto {
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
  @IsEnum(ArchiveEntityType)
  entityType?: ArchiveEntityType;

  @IsOptional()
  @IsISO8601()
  archivedFrom?: string;

  @IsOptional()
  @IsISO8601()
  archivedTo?: string;

  @IsOptional()
  @IsUUID()
  archivedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreatePurgePreviewDto {
  @IsEnum(ArchiveEntityType)
  rootType!: ArchiveEntityType;

  @IsUUID()
  rootId!: string;
}

export class EnqueuePurgeDto extends CreatePurgePreviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  confirmation!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(128)
  previewHash!: string;

  @IsUUID()
  idempotencyKey!: string;
}

export class RetryDeletionJobDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsIn([true])
  acknowledgeFailure?: true;
}

export class ArchiveGatewayCommandDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SensorReadingPurgeFilterDto {
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
  nodeTypeId?: string;

  @IsOptional()
  @IsUUID()
  nodeId?: string;

  @IsOptional()
  @IsEnum(SensorReadingStatus)
  status?: SensorReadingStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  faultFiltered?: boolean;

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}

export class EnqueueSensorReadingPurgeDto extends SensorReadingPurgeFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  confirmation!: string;

  @IsString()
  @MinLength(32)
  @MaxLength(128)
  previewHash!: string;

  @IsUUID()
  idempotencyKey!: string;
}
