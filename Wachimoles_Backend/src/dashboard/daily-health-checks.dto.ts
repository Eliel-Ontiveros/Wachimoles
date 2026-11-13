import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import { HEALTH_STATUS_LEVELS, HealthStatusLevel } from "./dashboard.types";

export class DailyHealthCheckParamsDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateIso!: string;
}

export class SaveDailyHealthCheckDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  bloodSugarMgDl?: number | null;

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(300)
  systolicBp?: number | null;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  diastolicBp?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(45)
  temperatureC?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  sleepHours?: number | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  mood!: number;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  symptoms!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsIn(HEALTH_STATUS_LEVELS)
  overallStatus!: HealthStatusLevel;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(1000)
  recommendation!: string;
}

export class DailyHealthChecksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
