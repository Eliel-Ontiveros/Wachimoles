import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { DashboardDataController } from "./dashboard-data.controller";
import { BodyConditionsController } from "./body-conditions.controller";
import { BodyConditionImagesController } from "./body-condition-images.controller";
import { DailyHealthChecksController } from "./daily-health-checks.controller";
import { MissionsController } from "./missions.controller";
import { AstronautMissionController } from "./astronaut-mission.controller";
import { AstronautLocationController } from "./astronaut-location.controller";
import { DashboardWebGuard } from "./dashboard-web.guard";
import { SupabaseService } from "./supabase.service";
import { WeightsController } from "./weights.controller";
import { WeightsService } from "./weights.service";

@Module({
  controllers: [
    DashboardController,
    DashboardDataController,
    BodyConditionsController,
    BodyConditionImagesController,
    DailyHealthChecksController,
    MissionsController,
    AstronautMissionController,
    AstronautLocationController,
    WeightsController
  ],
  providers: [
    DashboardTokenGuard,
    DashboardWebGuard,
    SupabaseService,
    WeightsService
  ]
})
export class DashboardModule {}
