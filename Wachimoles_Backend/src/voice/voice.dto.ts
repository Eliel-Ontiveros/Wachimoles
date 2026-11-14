import { IsString, MaxLength, MinLength } from "class-validator";

export class InterpretVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text!: string;
}
