import { Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";
import { BodySex } from "./body-metrics";

export const BODY_SEXES = ["male", "female"] as const;

export class SaveBodyProfileDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(50)
  @Max(250)
  heightCm!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  ageYears?: number | null;

  @IsOptional()
  @IsIn(BODY_SEXES)
  sex?: BodySex | null;
}

export class WeightsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
