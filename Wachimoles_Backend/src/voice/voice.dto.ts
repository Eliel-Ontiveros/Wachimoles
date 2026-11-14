import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { VOICE_LOCALES, VoiceLocale } from "./voice.service";

export const HISTORY_ROLES = ["user", "assistant"] as const;
export type HistoryRole = (typeof HISTORY_ROLES)[number];

export class VoiceHistoryItemDto {
  @IsIn(HISTORY_ROLES)
  role!: HistoryRole;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  content!: string;
}

export class InterpretVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;

  @IsOptional()
  @IsIn(VOICE_LOCALES)
  locale?: VoiceLocale;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => VoiceHistoryItemDto)
  history?: VoiceHistoryItemDto[];
}
