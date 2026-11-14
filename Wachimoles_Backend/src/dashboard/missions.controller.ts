import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { DashboardRequest, MisionCatalogo, MisionDiariaRotada } from "./dashboard.types";
import { ConsultarMisionesQueryDto } from "./missions.dto";
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

  @Get()
  @Header("Cache-Control", "no-store")
  obtenerCatalogoMisiones(
    @Query() query: ConsultarMisionesQueryDto
  ): Promise<MisionCatalogo[]> {
    return this.supabase.obtenerCatalogoMisiones(query.entorno, query.dificultad);
  }
}
