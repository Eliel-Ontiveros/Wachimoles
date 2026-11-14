import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { VOICE_LOCALES, VoiceLocale } from "./voice.service";

export class InterpretVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;

  @IsOptional()
  @IsIn(VOICE_LOCALES)
  locale?: VoiceLocale;
}
