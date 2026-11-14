import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  DashboardRequest,
  MisionCatalogo,
  MisionDiariaRotada,
  RachaAstronauta,
  RespuestaProgresoMisiones
} from "./dashboard.types";
import {
  ActualizarItemMisionDto,
  ConsultarMisionesQueryDto,
  ConsultarProgresoMisionesQueryDto,
  SincronizarProgresoMisionesDto
} from "./missions.dto";
import { DashboardTokenGuard } from "./dashboard-token.guard";
import { SupabaseService } from "./supabase.service";

@Controller("dashboard/missions")
@UseGuards(DashboardTokenGuard)
export class MissionsController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get("daily")
  @Header("Cache-Control", "no-store")
  obtenerMisionesDelDia(
    @Req() request: DashboardRequest,
    @Query() query: ConsultarMisionesQueryDto
  ): Promise<MisionDiariaRotada[]> {
    return this.supabase.obtenerMisionesDelDia(request.dashboardUserId, query);
  }

  @Get("streak")
  @Header("Cache-Control", "no-store")
  obtenerRacha(
    @Req() request: DashboardRequest
  ): Promise<RachaAstronauta> {
    return this.supabase.obtenerRachaAstronauta(request.dashboardUserId);
  }

  @Get("daily/progress")
  @Header("Cache-Control", "no-store")
  obtenerProgresoMisiones(
    @Req() request: DashboardRequest,
    @Query() query: ConsultarProgresoMisionesQueryDto
  ) {
    return this.supabase.obtenerProgresoMisionesDelDia(
      request.dashboardUserId,
      query.fecha
    );
  }

  @Put("daily/progress")
  @Header("Cache-Control", "no-store")
  sincronizarProgresoMisionesPut(
    @Req() request: DashboardRequest,
    @Body() body: SincronizarProgresoMisionesDto
  ): Promise<RespuestaProgresoMisiones> {
    return this.supabase.sincronizarProgresoMisionesDiarias(
      request.dashboardUserId,
      body
    );
  }

  @Post("daily/progress")
  @Header("Cache-Control", "no-store")
  sincronizarProgresoMisionesPost(
    @Req() request: DashboardRequest,
    @Body() body: SincronizarProgresoMisionesDto
  ): Promise<RespuestaProgresoMisiones> {
    return this.supabase.sincronizarProgresoMisionesDiarias(
      request.dashboardUserId,
      body
    );
  }

  @Put("daily/:misionId")
  @Header("Cache-Control", "no-store")
  actualizarItemMision(
    @Req() request: DashboardRequest,
    @Param("misionId") misionId: string,
    @Body() body: ActualizarItemMisionDto
  ): Promise<RespuestaProgresoMisiones> {
    return this.supabase.actualizarItemMisionDiaria(
      request.dashboardUserId,
      misionId,
      body
    );
  }

  @Patch("daily/:misionId")
  @Header("Cache-Control", "no-store")
  actualizarItemMisionPatch(
    @Req() request: DashboardRequest,
    @Param("misionId") misionId: string,
    @Body() body: ActualizarItemMisionDto
  ): Promise<RespuestaProgresoMisiones> {
    return this.supabase.actualizarItemMisionDiaria(
      request.dashboardUserId,
      misionId,
      body
    );
  }

  @Get()
  @Header("Cache-Control", "no-store")
  obtenerCatalogoMisiones(
    @Query() query: ConsultarMisionesQueryDto
  ): Promise<MisionCatalogo[]> {
    return this.supabase.obtenerCatalogoMisiones(query.entorno, query.dificultad);
  }
}

