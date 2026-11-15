import { Transform, Type } from "class-transformer";
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

const BODY_REGION_ALIASES: Record<string, BodyRegionCategory> = {
  "cabeza y cuello": "Cabeza y cuello",
  "head and neck": "Cabeza y cuello",
  "tronco anterior": "Tronco anterior",
  "front torso": "Tronco anterior",
  "anterior torso": "Tronco anterior",
  "tronco posterior": "Tronco posterior",
  "back torso": "Tronco posterior",
  "posterior torso": "Tronco posterior",
  "extremidad superior": "Extremidad superior",
  "upper limb": "Extremidad superior",
  "cadera y pelvis": "Cadera y pelvis",
  "hip and pelvis": "Cadera y pelvis",
  "extremidad inferior": "Extremidad inferior",
  "lower limb": "Extremidad inferior"
};

function normalizeBodyRegionInput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().replace(/\s+/g, " ").toLowerCase();
  return BODY_REGION_ALIASES[normalized] ?? value.trim();
}

export class BodyConditionParamsDto {
  @Matches(/^[a-z0-9_]{1,60}$/)
  muscleId!: string;
}

export class BodyConditionImageParamsDto extends BodyConditionParamsDto {
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i)
  fileName!: string;
}

export class SaveBodyConditionDto {
  @Transform(({ value }) => normalizeBodyRegionInput(value))
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
