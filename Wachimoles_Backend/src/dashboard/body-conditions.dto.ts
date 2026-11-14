import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { BODY_REGION_CATEGORIES, BodyRegionCategory } from "./dashboard.types";

export class BodyConditionParamsDto {
  @Matches(/^[a-z0-9_]{1,60}$/)
  muscleId!: string;
}

export class BodyConditionImageParamsDto extends BodyConditionParamsDto {
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i)
  fileName!: string;
}

export class SaveBodyConditionDto {
  @IsIn(BODY_REGION_CATEGORIES)
  bodyRegion!: BodyRegionCategory;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  muscleName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(100)
  conditionName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  painIntensity!: number;

  @IsBoolean()
  swelling!: boolean;

  @IsBoolean()
  functionalLimitation!: boolean;
}

export class BodyConditionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
