import { IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { BuildingImageKind, CompanyStatus } from "@prisma/client";

export class InitialPlatformManagerDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateCompanyDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Type(() => InitialPlatformManagerDto)
  @ValidateNested()
  platformManager!: InitialPlatformManagerDto;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

export class UpdateOrganizationStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}

export class CreateAreaDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  name!: string;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

export class CreateBuildingDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  buildingType?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsString()
  title!: string;
}

export class UpdateBuildingDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  buildingType?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;
}

export class UploadBuildingImageDto {
  @IsEnum(BuildingImageKind)
  kind!: BuildingImageKind;
}
