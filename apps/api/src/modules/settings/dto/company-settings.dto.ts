import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCompanySettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
