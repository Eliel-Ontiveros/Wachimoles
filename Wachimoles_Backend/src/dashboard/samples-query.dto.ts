import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { SAMPLE_METRICS, SampleMetric } from "./dashboard.types";

export class SamplesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsIn(SAMPLE_METRICS)
  metric?: SampleMetric;
}
