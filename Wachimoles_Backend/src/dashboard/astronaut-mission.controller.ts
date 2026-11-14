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
import {
  DashboardRequest,
  EstadoMisionAstronauta,
  UbicacionAstronauta
} from "./dashboard.types";
import {
  GuardarEstadoMisionDto,
  LlegadaAnticipadaDto,
  GuardarUbicacionAstronautaDto
} from "./astronaut-mission.dto";
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

  @Get("location")
  @Header("Cache-Control", "no-store")
  obtenerUbicacion(
    @Req() request: DashboardRequest
  ): Promise<UbicacionAstronauta> {
    return this.supabase.obtenerUbicacionActualAstronauta(
      request.dashboardUserId
    );
  }

  @Put("location")
  @Header("Cache-Control", "no-store")
  guardarUbicacion(
    @Req() request: DashboardRequest,
    @Body() body: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    return this.supabase.guardarUbicacionActualAstronauta(
      request.dashboardUserId,
      body
    );
  }

  @Patch("environment")
  @Header("Cache-Control", "no-store")
  guardarUbicacionPatch(
    @Req() request: DashboardRequest,
    @Body() body: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    return this.supabase.guardarUbicacionActualAstronauta(
      request.dashboardUserId,
      body
    );
  }
}

