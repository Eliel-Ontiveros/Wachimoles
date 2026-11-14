import { Body, Controller, Header, HttpCode, Post, UseGuards } from "@nestjs/common";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { InterpretVoiceDto } from "./voice.dto";
import { InterpretResult, VoiceService } from "./voice.service";

@Controller("voice")
@UseGuards(DashboardTokenGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post("interpret")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  interpret(@Body() body: InterpretVoiceDto): Promise<InterpretResult> {
    return this.voice.interpret(body.text.trim());
  }
}
