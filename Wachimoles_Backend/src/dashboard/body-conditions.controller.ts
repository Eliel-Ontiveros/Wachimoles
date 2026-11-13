import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest, BodyCondition } from "./dashboard.types";
import {
  BodyConditionParamsDto,
  BodyConditionsQueryDto,
  SaveBodyConditionDto
} from "./body-conditions.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard/body-conditions")
@UseGuards(DashboardTokenGuard)
export class BodyConditionsController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  getBodyConditions(
    @Req() request: DashboardRequest,
    @Query() query: BodyConditionsQueryDto
  ): Promise<BodyCondition[]> {
    return this.supabase.getBodyConditions(request.dashboardUserId, query);
  }

  @Put(":muscleId")
  @Header("Cache-Control", "no-store")
  saveBodyCondition(
    @Req() request: DashboardRequest,
    @Param() params: BodyConditionParamsDto,
    @Body() body: SaveBodyConditionDto
  ): Promise<BodyCondition> {
    return this.supabase.saveBodyCondition(
      request.dashboardUserId,
      params.muscleId,
      body
    );
  }

  @Delete(":muscleId")
  @Header("Cache-Control", "no-store")
  resolveBodyCondition(
    @Req() request: DashboardRequest,
    @Param() params: BodyConditionParamsDto
  ): Promise<{ resolved: true }> {
    return this.supabase.resolveBodyCondition(
      request.dashboardUserId,
      params.muscleId
    );
  }
}
