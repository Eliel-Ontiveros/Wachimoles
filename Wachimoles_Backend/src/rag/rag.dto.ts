import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class MuscleReportDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(180)
  conditionName!: string;

  @IsInt()
  @Min(0)
  @Max(10)
  painIntensity!: number;

  @IsBoolean()
  swelling!: boolean;

  @IsBoolean()
  functionalLimitation!: boolean;

  @IsString()
  @MaxLength(700)
  notes!: string;

  @IsOptional()
  @IsISO8601()
  @MaxLength(40)
  recordedAtIso?: string;
}

export class AskRagDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(1500)
  question!: string;

  @IsIn(["earth", "spacecraft", "moon", "mars"])
  environment!: "earth" | "spacecraft" | "moon" | "mars";

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bodyZone?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MuscleReportDto)
  muscleReport?: MuscleReportDto;
}
