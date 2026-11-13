import { Controller, Get, Header, Query, Req, UseGuards } from "@nestjs/common";
import { DashboardRequest, DashboardSample } from "./dashboard.types";
import { SamplesQueryDto } from "./samples-query.dto";
import { DashboardWebGuard } from "./dashboard-web.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard")
export class DashboardDataController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get("data")
  @UseGuards(DashboardWebGuard)
  @Header("Cache-Control", "no-store")
  getData(
    @Req() request: DashboardRequest,
    @Query() query: SamplesQueryDto
  ): Promise<DashboardSample[]> {
    return this.supabase.getSamples(request.dashboardUserId, query);
  }
}
