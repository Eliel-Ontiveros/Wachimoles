import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthController } from "./health.controller";
import { VoiceModule } from "./voice/voice.module";
import { validateEnvironment } from "./validate-environment";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment
    }),
    DashboardModule,
    VoiceModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
