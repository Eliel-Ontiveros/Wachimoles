import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthController } from "./health.controller";
import { validateEnvironment } from "./validate-environment";
import { RagModule } from "./rag/rag.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment
    }),
    DashboardModule,
    RagModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
