import { IsEnum, IsOptional, IsString } from "class-validator";
import { DeviceLifecycleStatus, GatewayType } from "@prisma/client";

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
  nodeTypeId!: string;

  @IsString()
  number!: string;
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
