import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class RegisterNodesCommandDto {
  @IsString()
  gatewayId!: string;

  @IsString()
  buildingId!: string;

  @IsString()
  nodeTypeId!: string;

  @ArrayNotEmpty()
  @IsArray()
  @IsString({ each: true })
  nodeIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}

export class WakeSecurityCommandDto {
  @IsString()
  gatewayId!: string;

  @IsBoolean()
  alarmActive!: boolean;

  @IsInt()
  @Min(0)
  alertLevel!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}

export class SetAlarmLevelsCommandDto {
  @IsString()
  gatewayId!: string;

  @IsString()
  nodeTypeId!: string;

  @IsBoolean()
  alarmEnabled!: boolean;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  alarmLevel1?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  alarmLevel2?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  alarmLevel3?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}

export class SetFaultFilterCommandDto {
  @IsString()
  gatewayId!: string;

  @IsString()
  nodeTypeId!: string;

  @ArrayNotEmpty()
  @IsArray()
  @IsString({ each: true })
  nodeIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}
