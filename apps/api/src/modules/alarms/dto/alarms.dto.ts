import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { AlarmChannel, AlarmEventStatus, AlarmSeverity, AlarmTargetType } from "@prisma/client";

export class ListAlarmRulesQueryDto {
  @IsOptional()
  @IsString()
  buildingId?: string;
}

export class ListAlarmsQueryDto {
  @IsOptional()
  @IsString()
  buildingId?: string;

  @IsOptional()
  @IsEnum(AlarmSeverity)
  severity?: AlarmSeverity;

  @IsOptional()
  @IsEnum(AlarmEventStatus)
  status?: AlarmEventStatus;
}

export class AlarmActionNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateAlarmRuleDto {
  @IsString()
  buildingId!: string;

  @IsString()
  nodeTypeId!: string;

  @IsEnum(AlarmSeverity)
  severity!: AlarmSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class UpdateAlarmRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(AlarmSeverity)
  severity?: AlarmSeverity;
}

export class CreateAlarmRecipientPolicyDto {
  @IsEnum(AlarmTargetType)
  targetType!: AlarmTargetType;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  specificUserId?: string;

  @IsInt()
  @Min(1)
  requiredOccurrenceCount!: number;

  @IsInt()
  @Min(0)
  countIntervalSeconds!: number;

  @IsEnum(AlarmChannel)
  channel!: AlarmChannel;

  @IsOptional()
  @IsObject()
  channelMetadata?: Record<string, unknown>;
}

export class UpdateAlarmRecipientPolicyDto {
  @IsOptional()
  @IsEnum(AlarmTargetType)
  targetType?: AlarmTargetType;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  specificUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredOccurrenceCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  countIntervalSeconds?: number;

  @IsOptional()
  @IsEnum(AlarmChannel)
  channel?: AlarmChannel;

  @IsOptional()
  @IsObject()
  channelMetadata?: Record<string, unknown>;
}
