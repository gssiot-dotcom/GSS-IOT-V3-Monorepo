import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { DeviceLifecycleStatus, GatewayType } from "@prisma/client";

export class CompanyDeviceInventoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  gatewayPage = 1;

  @Type(() => Number)
  @IsIn([50, 100])
  @IsInt()
  @IsOptional()
  gatewayPageSize: 50 | 100 = 50;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  nodePage = 1;

  @Type(() => Number)
  @IsIn([50, 100])
  @IsInt()
  @IsOptional()
  nodePageSize: 50 | 100 = 50;
}

export class CreateGatewayDto {
  @IsEnum(GatewayType)
  gatewayType!: GatewayType;

  @IsOptional()
  @IsString()
  installedLocation?: string;

  @IsString()
  serialNumber!: string;
}

export class UpdateGatewayDto {
  @IsOptional()
  @IsEnum(GatewayType)
  gatewayType?: GatewayType;

  @IsOptional()
  @IsString()
  installedLocation?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(DeviceLifecycleStatus)
  status?: DeviceLifecycleStatus;
}

export class CreateNodeDto {
  @IsOptional()
  @IsString()
  installedLocation?: string;

  @IsString()
  @IsUUID()
  nodeTypeId!: string;

  @IsString()
  number!: string;
}

export class BulkCreateNodesDto {
  @IsOptional()
  @IsString()
  installedLocation?: string;

  @IsString()
  input!: string;

  @IsString()
  @IsUUID()
  nodeTypeId!: string;
}

export class UpdateNodeDto {
  @IsOptional()
  @IsString()
  installedLocation?: string;

  @IsOptional()
  @IsString()
  nodeTypeId?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsEnum(DeviceLifecycleStatus)
  status?: DeviceLifecycleStatus;
}

export class AssignDeviceToCompanyDto {
  @IsString()
  companyId!: string;
}

export class AssignGatewayToBuildingDto {
  @IsString()
  buildingId!: string;
}

export class AssignNodeToGatewayDto {
  @IsString()
  gatewayId!: string;
}
