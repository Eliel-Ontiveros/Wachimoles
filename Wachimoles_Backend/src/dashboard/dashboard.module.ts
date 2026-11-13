import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { DashboardDataController } from "./dashboard-data.controller";
import { BodyConditionsController } from "./body-conditions.controller";
import { DailyHealthChecksController } from "./daily-health-checks.controller";
import { DashboardWebGuard } from "./dashboard-web.guard";
import { SupabaseService } from "./supabase.service";

@Module({
  controllers: [
    DashboardController,
    DashboardDataController,
    BodyConditionsController,
    DailyHealthChecksController
  ],
  providers: [DashboardTokenGuard, DashboardWebGuard, SupabaseService]
})
export class DashboardModule {}
