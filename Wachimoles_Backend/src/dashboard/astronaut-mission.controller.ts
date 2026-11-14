import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest, EstadoMisionAstronauta } from "./dashboard.types";
import { GuardarEstadoMisionDto, LlegadaAnticipadaDto } from "./astronaut-mission.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard/mission-state")
@UseGuards(DashboardTokenGuard)
export class AstronautMissionController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  obtenerEstadoMision(
    @Req() request: DashboardRequest
  ): Promise<EstadoMisionAstronauta | null> {
    return this.supabase.obtenerEstadoMisionAstronauta(request.dashboardUserId);
  }

  @Put()
  @Header("Cache-Control", "no-store")
  guardarEstadoMision(
    @Req() request: DashboardRequest,
    @Body() body: GuardarEstadoMisionDto
  ): Promise<EstadoMisionAstronauta> {
    return this.supabase.guardarEstadoMisionAstronauta(
      request.dashboardUserId,
      body
    );
  }

  @Post("arrive-early")
  @Header("Cache-Control", "no-store")
  marcarLlegadaAnticipada(
    @Req() request: DashboardRequest,
    @Body() body: LlegadaAnticipadaDto
  ): Promise<EstadoMisionAstronauta> {
    return this.supabase.marcarLlegadaAnticipada(
      request.dashboardUserId,
      body
    );
  }
}
