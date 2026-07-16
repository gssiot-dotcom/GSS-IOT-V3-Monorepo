import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class SensorHistoryQueryDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  page?: number;

  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  pageSize?: number;
}
