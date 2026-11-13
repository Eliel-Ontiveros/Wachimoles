import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest, DailyHealthCheck } from "./dashboard.types";
import {
  DailyHealthCheckParamsDto,
  DailyHealthChecksQueryDto,
  SaveDailyHealthCheckDto
} from "./daily-health-checks.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard/health-checks")
@UseGuards(DashboardTokenGuard)
export class DailyHealthChecksController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  getDailyHealthChecks(
    @Req() request: DashboardRequest,
    @Query() query: DailyHealthChecksQueryDto
  ): Promise<DailyHealthCheck[]> {
    return this.supabase.getDailyHealthChecks(
      request.dashboardUserId,
      query
    );
  }

  @Put(":dateIso")
  @Header("Cache-Control", "no-store")
  saveDailyHealthCheck(
    @Req() request: DashboardRequest,
    @Param() params: DailyHealthCheckParamsDto,
    @Body() body: SaveDailyHealthCheckDto
  ): Promise<DailyHealthCheck> {
    return this.supabase.saveDailyHealthCheck(
      request.dashboardUserId,
      params.dateIso,
      body
    );
  }
}
