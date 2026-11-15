import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest } from "./dashboard.types";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SaveBodyProfileDto, WeightsQueryDto } from "./weights.dto";
import {
  BodyProfileRecord,
  WeightRecord,
  WeightsService
} from "./weights.service";

@Controller("dashboard")
@UseGuards(DashboardTokenGuard)
export class WeightsController {
  constructor(private readonly weights: WeightsService) {}

  @Get("weights")
  @Header("Cache-Control", "no-store")
  getWeights(
    @Req() request: DashboardRequest,
    @Query() query: WeightsQueryDto
  ): Promise<WeightRecord[]> {
    return this.weights.getWeights(request.dashboardUserId, query.limit);
  }

  @Get("body-profile")
  @Header("Cache-Control", "no-store")
  async getBodyProfile(
    @Req() request: DashboardRequest
  ): Promise<BodyProfileRecord> {
    const profile = await this.weights.getBodyProfile(request.dashboardUserId);
    if (!profile) {
      throw new NotFoundException("No body profile has been set.");
    }
    return profile;
  }

  @Put("body-profile")
  @Header("Cache-Control", "no-store")
  saveBodyProfile(
    @Req() request: DashboardRequest,
    @Body() body: SaveBodyProfileDto
  ): Promise<BodyProfileRecord> {
    return this.weights.saveBodyProfile(request.dashboardUserId, body);
  }
}
