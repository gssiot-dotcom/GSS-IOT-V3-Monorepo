import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const roleKeyPattern = /^[a-z0-9][a-z0-9._-]*$/;

export class CreateGssRoleDto {
  @IsString()
  @Matches(roleKeyPattern)
  @MaxLength(80)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  permissionIds?: string[];
}

export class UpdateGssRoleDto {
  @IsString()
  @Matches(roleKeyPattern)
  @MaxLength(80)
  @IsOptional()
  key?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  permissionIds?: string[];
}
