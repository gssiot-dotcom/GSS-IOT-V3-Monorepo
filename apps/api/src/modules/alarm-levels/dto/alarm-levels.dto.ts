import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

const alarmNodeTypes = ["door_node", "angle_node", "gangform_node"] as const;

export class UpdateBuildingAlarmLevelDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  cautionThreshold?: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  dangerThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}

export class UpdateFaultFilterDto {
  @IsString()
  gatewayId!: string;

  @IsString()
  nodeTypeId!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  nodeIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}

export class ToggleGatewayAlarmLevelDto {
  @IsIn(alarmNodeTypes)
  nodeType!: (typeof alarmNodeTypes)[number];

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number;
}
