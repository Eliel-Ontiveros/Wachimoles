import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

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
}
