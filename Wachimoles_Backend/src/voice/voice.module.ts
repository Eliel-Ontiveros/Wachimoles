import { Module } from "@nestjs/common";
import { DashboardTokenGuard } from "../dashboard/dashboard-token.guard";
import { VoiceController } from "./voice.controller";
import { VoiceService } from "./voice.service";

@Module({
  controllers: [VoiceController],
  providers: [DashboardTokenGuard, VoiceService]
})
export class VoiceModule {}
