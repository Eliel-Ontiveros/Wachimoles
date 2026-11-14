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

export class ConsultarMisionesQueryDto {
  @IsOptional()
  @IsIn(["tierra", "nave", "estacion", "luna", "marte", "all"])
  entorno?: "tierra" | "nave" | "estacion" | "luna" | "marte" | "all";

  @IsOptional()
  @IsIn(["baja", "media", "alta"])
  dificultad?: "baja" | "media" | "alta";

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La fecha debe tener formato YYYY-MM-DD" })
  fecha?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pasosActuales?: number;

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
  @IsString()
  misionId: string;

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

