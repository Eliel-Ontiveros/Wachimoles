import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { EntornoMision, DificultadMision } from "./dashboard.types";

export class ConsultarMisionesQueryDto {
  @IsOptional()
  @IsIn([
    "earth",
    "spaceship",
    "station",
    "moon",
    "mars",
    "all",
    "tierra",
    "nave",
    "estacion",
    "luna",
    "marte"
  ])
  entorno?: EntornoMision;

  @IsOptional()
  @IsIn([
    "earth",
    "spaceship",
    "station",
    "moon",
    "mars",
    "all",
    "tierra",
    "nave",
    "estacion",
    "luna",
    "marte"
  ])
  environment?: EntornoMision;

  @IsOptional()
  @IsIn(["low", "medium", "high", "baja", "media", "alta"])
  dificultad?: DificultadMision;

  @IsOptional()
  @IsIn(["low", "medium", "high", "baja", "media", "alta"])
  difficulty?: DificultadMision;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe tener formato YYYY-MM-DD" })
  fecha?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must have YYYY-MM-DD format" })
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pasosActuales?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentSteps?: number;

  @IsOptional()
  checkinRealizado?: boolean | string;

  @IsOptional()
  caminadoraActiva?: boolean | string;
}

export class ConsultarProgresoMisionesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe tener formato YYYY-MM-DD" })
  fecha?: string;
}

export class ItemProgresoMisionDto {
  @IsOptional()
  @IsString()
  misionId?: string;

  @IsOptional()
  @IsString()
  missionId?: string;

  @IsOptional()
  @IsBoolean()
  completada?: boolean;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorObjetivo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetValue?: number;
}

export class SincronizarProgresoMisionesDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe tener formato YYYY-MM-DD" })
  fecha?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemProgresoMisionDto)
  misiones: ItemProgresoMisionDto[];
}

export class ActualizarItemMisionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe tener formato YYYY-MM-DD" })
  fecha?: string;

  @IsBoolean()
  completada: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorActual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorObjetivo?: number;
}

