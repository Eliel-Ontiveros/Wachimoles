import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";
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
