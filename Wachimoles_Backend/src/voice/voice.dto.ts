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
import { VoiceScreen, VoiceTab } from "./voice-intent";
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

export const CONTEXT_SCREENS = ["/", "/explore", "/missions"] as const;
export const CONTEXT_TABS = ["body", "health", "records"] as const;

export class VoiceContextDto {
  @IsIn(CONTEXT_SCREENS)
  screen!: VoiceScreen;

  @IsOptional()
  @IsIn(CONTEXT_TABS)
  tab?: VoiceTab;
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

  @IsOptional()
  @ValidateNested()
  @Type(() => VoiceContextDto)
  context?: VoiceContextDto;
}
