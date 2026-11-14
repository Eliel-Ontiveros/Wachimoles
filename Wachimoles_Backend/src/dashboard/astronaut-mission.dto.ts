import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import { UbicacionEspacial, EstadoMision, UbicacionEntorno } from "./dashboard.types";

export class GuardarEstadoMisionDto {
  @IsOptional()
  @IsIn(["tierra", "estacion", "luna", "marte"])
  origen?: UbicacionEspacial;

  @IsOptional()
  @IsIn(["tierra", "estacion", "luna", "marte"])
  origin?: UbicacionEspacial;

  @IsOptional()
  @IsIn(["tierra", "estacion", "luna", "marte"])
  destino?: UbicacionEspacial;

  @IsOptional()
  @IsIn(["tierra", "estacion", "luna", "marte"])
  destination?: UbicacionEspacial;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "fechaSalida debe tener formato YYYY-MM-DD" })
  fechaSalida?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "departureDate debe tener formato YYYY-MM-DD" })
  departureDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "fechaLlegadaEstimada debe tener formato YYYY-MM-DD" })
  fechaLlegadaEstimada?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "estimatedArrivalDate debe tener formato YYYY-MM-DD" })
  estimatedArrivalDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  diasTotales?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  totalDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  diaActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentajeProgresoRelativo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  relativeProgressPct?: number;

  @IsOptional()
  @IsIn(["tierra", "nave", "estacion", "luna", "marte"])
  entornoActual?: "tierra" | "nave" | "estacion" | "luna" | "marte";

  @IsOptional()
  @IsIn(["tierra", "nave", "estacion", "luna", "marte"])
  currentEnvironment?: "tierra" | "nave" | "estacion" | "luna" | "marte";

  @IsOptional()
  @IsIn(["scheduled", "in_transit", "arrived"])
  estado?: EstadoMision;

  @IsOptional()
  @IsIn(["scheduled", "in_transit", "arrived"])
  status?: EstadoMision;
}

export class LlegadaAnticipadaDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "fechaLlegadaReal debe tener formato YYYY-MM-DD" })
  fechaLlegadaReal?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "actualArrivalDate debe tener formato YYYY-MM-DD" })
  actualArrivalDate?: string;
}

export class GuardarUbicacionAstronautaDto {
  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(["tierra", "nave", "estacion", "luna", "marte"])
  entorno?: UbicacionEntorno;

  @IsOptional()
  @IsIn(["tierra", "nave", "estacion", "luna", "marte"])
  environment?: UbicacionEntorno;
}

