import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest, UbicacionAstronauta } from "./dashboard.types";
import { GuardarUbicacionAstronautaDto } from "./astronaut-mission.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller(["dashboard/astronaut/location", "mission/environment"])
@UseGuards(DashboardTokenGuard)
export class AstronautLocationController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  obtenerUbicacionActual(
    @Req() request: DashboardRequest
  ): Promise<UbicacionAstronauta> {
    return this.supabase.obtenerUbicacionActualAstronauta(
      request.dashboardUserId
    );
  }

  @Put()
  @Header("Cache-Control", "no-store")
  guardarUbicacionActualPut(
    @Req() request: DashboardRequest,
    @Body() body: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    return this.supabase.guardarUbicacionActualAstronauta(
      request.dashboardUserId,
      body
    );
  }

  @Post()
  @Header("Cache-Control", "no-store")
  guardarUbicacionActualPost(
    @Req() request: DashboardRequest,
    @Body() body: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    return this.supabase.guardarUbicacionActualAstronauta(
      request.dashboardUserId,
      body
    );
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  guardarUbicacionActualPatch(
    @Req() request: DashboardRequest,
    @Body() body: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    return this.supabase.guardarUbicacionActualAstronauta(
      request.dashboardUserId,
      body
    );
  }
}
