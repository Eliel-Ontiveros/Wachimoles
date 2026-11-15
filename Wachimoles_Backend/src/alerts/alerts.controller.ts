import { Controller, Get, Header, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DashboardRequest } from "../dashboard/dashboard.types";
import { SupabaseService } from "../dashboard/supabase.service";
import { AlertAudienceParams, AlertParams } from "./alerts.dto";
import { AlertsGuard } from "./alerts.guard";

@Controller("dashboard/alerts")
@UseGuards(AlertsGuard)
export class AlertsController {
  constructor(private readonly supabase: SupabaseService) {}
  @Get(":audience")
  @Header("Cache-Control", "no-store")
  list(@Req() req: DashboardRequest, @Param() params: AlertAudienceParams) {
    return this.supabase.getHealthAlerts(req.dashboardUserId, params.audience);
  }
  @Post(":audience/:id/acknowledge")
  @Header("Cache-Control", "no-store")
  acknowledge(@Req() req: DashboardRequest, @Param() params: AlertParams) {
    return this.supabase.acknowledgeHealthAlert(req.dashboardUserId, params.audience, params.id);
  }
}
