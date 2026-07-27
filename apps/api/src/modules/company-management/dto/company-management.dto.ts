import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { AccessLevel, PermissionEffect } from "@prisma/client";

export class DirectPermissionDto {
  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @IsUUID()
  permissionId!: string;
}

export class AreaAccessDto {
  @IsEnum(AccessLevel)
  accessLevel!: AccessLevel;

  @IsUUID()
  areaId!: string;
}

export class BuildingAccessDto {
  @IsEnum(AccessLevel)
  accessLevel!: AccessLevel;

  @IsUUID()
  buildingId!: string;
}

export class CreateCompanyUserDto {
  @Type(() => AreaAccessDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  areaAccess?: AreaAccessDto[];

  @Type(() => BuildingAccessDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  buildingAccess?: BuildingAccessDto[];

  @Type(() => DirectPermissionDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  directPermissions?: DirectPermissionDto[];

  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsUUID()
  roleId!: string;
}

export class UpdateCompanyUserDto {
  @Type(() => AreaAccessDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  areaAccess?: AreaAccessDto[];

  @Type(() => BuildingAccessDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  buildingAccess?: BuildingAccessDto[];

  @Type(() => DirectPermissionDto)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  directPermissions?: DirectPermissionDto[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class UpdateCompanyUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateCompanyRoleDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsArray()
  @IsUUID("4", { each: true })
  permissionIds!: string[];
}

export class UpdateCompanyRoleDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsOptional()
  @IsUUID("4", { each: true })
  permissionIds?: string[];
}

export class UpdateCompanyRolePermissionsDto {
  @IsArray()
  @IsUUID("4", { each: true })
  permissionIds!: string[];
}

export class CreateCompanyPositionDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;
}

export class UpdateCompanyPositionDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class UpdateCompanyPositionStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class PositionAssignmentDto {
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @IsUUID()
  positionId!: string;
}

export class ReplaceUserPositionAssignmentsDto {
  @Type(() => PositionAssignmentDto)
  @IsArray()
  @ValidateNested({ each: true })
  assignments!: PositionAssignmentDto[];
}
