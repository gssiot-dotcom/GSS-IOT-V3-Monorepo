import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
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

export class CreateBuildingPlanImageDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @IsEnum(BuildingImageKind)
  kind!: BuildingImageKind;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;
}

export class CreateImagesDto {
  @IsArray()
  @Type(() => CreateBuildingPlanImageDto)
  @ValidateNested({ each: true })
  images!: CreateBuildingPlanImageDto[];
}
