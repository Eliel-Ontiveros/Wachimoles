import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "./supabase.service";
import { MissionsController } from "./missions.controller";
import { AstronautMissionController } from "./astronaut-mission.controller";
import { AstronautLocationController } from "./astronaut-location.controller";
import { DashboardRequest } from "./dashboard.types";

describe("Misiones y Estado Relativo del Astronauta", () => {
  let supabase: SupabaseService;
  let missionsController: MissionsController;
  let astronautController: AstronautMissionController;
  let locationController: AstronautLocationController;
  const mockUserId = "43235979-2b38-4a17-9a38-632484accad9";
  const mockReq: DashboardRequest = {
    dashboardUserId: mockUserId
  } as DashboardRequest;

  beforeEach(() => {
    supabase = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret-key",
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      })
    );
    missionsController = new MissionsController(supabase);
    astronautController = new AstronautMissionController(supabase);
    locationController = new AstronautLocationController(supabase);
  });

  describe("Misiones y Rotación de Dificultades", () => {
    it("obtiene el catálogo de misiones", async () => {
      const misiones = await missionsController.obtenerCatalogoMisiones({});
      expect(misiones.length).toBeGreaterThan(5);
      expect(misiones.some((m) => m.categoria === "steps" && m.dificultad === "baja")).toBe(true);
      expect(misiones.some((m) => m.categoria === "steps" && m.dificultad === "alta")).toBe(true);
    });

    it("rota misiones del día con diferentes dificultades de pasos (menos pasos vs más pasos)", async () => {
      // Día con dificultad baja (menos pasos)
      const misionesDiaBaja = await missionsController.obtenerMisionesDelDia(mockReq, {
        entorno: "tierra",
        dificultad: "baja",
        fecha: "2026-11-14"
      });
      const misionPasosBaja = misionesDiaBaja.find((m) => m.categoria === "steps");
      expect(misionPasosBaja).toBeDefined();
      expect(misionPasosBaja?.dificultad).toBe("baja");
      expect(misionPasosBaja?.valorObjetivo).toBeLessThan(5000);

      // Día con dificultad alta (más pasos)
      const misionesDiaAlta = await missionsController.obtenerMisionesDelDia(mockReq, {
        entorno: "tierra",
        dificultad: "alta",
        fecha: "2026-11-14"
      });
      const misionPasosAlta = misionesDiaAlta.find((m) => m.categoria === "steps");
      expect(misionPasosAlta).toBeDefined();
      expect(misionPasosAlta?.dificultad).toBe("alta");
      expect(misionPasosAlta?.valorObjetivo).toBeGreaterThan(9000);

      // En nave usa caminadora
      const misionesNave = await missionsController.obtenerMisionesDelDia(mockReq, {
        entorno: "nave",
        fecha: "2026-11-14"
      });
      expect(misionesNave.some((m) => m.categoria === "treadmill")).toBe(true);
      expect(misionesNave.some((m) => m.categoria === "checkin")).toBe(true);
    });
  });

  describe("Ubicación Relativa del Astronauta", () => {
    it("guarda la ubicación relativa en perspectiva de la cantidad de días que dura su misión", async () => {
      const mockFetch = jest.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "mision-uuid-1",
              user_id: mockUserId,
              origen: "tierra",
              destino: "marte",
              fecha_salida: "2026-11-01",
              fecha_llegada_estimada: "2027-05-30",
              fecha_llegada_real: null,
              dias_totales: 210,
              dia_actual: 45,
              porcentaje_progreso_relativo: 21.43,
              entorno_actual: "nave",
              estado: "in_transit",
              llegada_anticipada: false,
              creado_en: "2026-11-01T00:00:00Z",
              actualizado_en: "2026-11-14T00:00:00Z"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const resultado = await astronautController.guardarEstadoMision(mockReq, {
        origen: "tierra",
        destino: "marte",
        fechaSalida: "2026-11-01",
        fechaLlegadaEstimada: "2027-05-30",
        diasTotales: 210,
        diaActual: 45,
        entornoActual: "nave"
      });

      expect(resultado.origen).toBe("tierra");
      expect(resultado.destino).toBe("marte");
      expect(resultado.diasTotales).toBe(210);
      expect(resultado.diaActual).toBe(45);
      expect(resultado.porcentajeProgresoRelativo).toBe(21.43);
      expect(resultado.estado).toBe("in_transit");
      expect(resultado.llegadaAnticipada).toBe(false);
      expect(mockFetch).toHaveBeenCalled();
      mockFetch.mockRestore();
    });
  });

  describe("Botón Llegué Antes", () => {
    it("permite registrar que el astronauta llegó antes de la estimación", async () => {
      // Mock para simular que existe una misión en tránsito
      const mockFetch = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: "mision-uuid-1",
                user_id: mockUserId,
                origen: "tierra",
                destino: "marte",
                fecha_salida: "2026-11-01",
                fecha_llegada_estimada: "2027-05-30",
                fecha_llegada_real: null,
                dias_totales: 210,
                dia_actual: 150,
                porcentaje_progreso_relativo: 71.4,
                entorno_actual: "nave",
                estado: "in_transit",
                llegada_anticipada: false,
                creado_en: "2026-11-01T00:00:00Z",
                actualizado_en: "2026-11-14T00:00:00Z"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // Segundo fetch: la respuesta del upsert de llegada anticipada
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: "mision-uuid-1",
                user_id: mockUserId,
                origen: "tierra",
                destino: "marte",
                fecha_salida: "2026-11-01",
                fecha_llegada_estimada: "2027-05-30",
                fecha_llegada_real: "2026-11-14",
                dias_totales: 210,
                dia_actual: 210,
                porcentaje_progreso_relativo: 100,
                entorno_actual: "marte",
                estado: "arrived",
                llegada_anticipada: true,
                creado_en: "2026-11-01T00:00:00Z",
                actualizado_en: "2026-11-14T12:00:00Z"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );

      const resultado = await astronautController.marcarLlegadaAnticipada(mockReq, {
        fechaLlegadaReal: "2026-11-14"
      });

      expect(resultado.estado).toBe("arrived");
      expect(resultado.llegadaAnticipada).toBe(true);
      expect(resultado.diaActual).toBe(210);
      expect(resultado.porcentajeProgresoRelativo).toBe(100);
      expect(resultado.entornoActual).toBe("marte");
      expect(resultado.fechaLlegadaReal).toBe("2026-11-14");
      mockFetch.mockRestore();
    });
  });

  describe("Ubicación Actual Independiente del Astronauta (Sin plan de vuelo)", () => {
    it("guarda la ubicación seleccionada ('marte') en la base de datos sin requerir plan de vuelo", async () => {
      const mockFetch = jest.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "loc-uuid-1",
              user_id: mockUserId,
              entorno: "marte",
              actualizado_en: "2026-11-14T12:00:00Z"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const resultado = await locationController.guardarUbicacionActualPut(mockReq, {
        entorno: "marte"
      });

      expect(resultado.entorno).toBe("marte");
      expect(resultado.environment).toBe("marte");
      expect(resultado.etiqueta).toBe("Superficie de Marte");
      expect(resultado.gravedadEtiqueta).toBe("0.38g Gravedad Marciana");
      expect(resultado.usuarioId).toBe(mockUserId);
      expect(mockFetch).toHaveBeenCalled();
      mockFetch.mockRestore();
    });

    it("obtiene la ubicación actual guardada de forma independiente", async () => {
      const mockFetch = jest.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "loc-uuid-2",
              user_id: mockUserId,
              entorno: "luna",
              actualizado_en: "2026-11-14T12:00:00Z"
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const resultado = await astronautController.obtenerUbicacion(mockReq);

      expect(resultado.entorno).toBe("luna");
      expect(resultado.environment).toBe("luna");
      expect(resultado.etiqueta).toBe("Base Lunar");
      expect(resultado.gravedadEtiqueta).toBe("0.16g Gravedad Lunar");
      expect(mockFetch).toHaveBeenCalled();
      mockFetch.mockRestore();
    });
  });

  describe("Cumplimiento de Misiones Diarias y Racha Acumulada", () => {
    it("guarda el progreso de misiones pero NO otorga racha si faltan tareas por completar", async () => {
      // Mock para consultar racha actual (racha = 0)
      const mockFetch = jest
        .spyOn(global, "fetch")
        // Lectura de racha previa
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                user_id: mockUserId,
                racha_actual: 0,
                racha_maxima: 0,
                total_dias_completados: 0,
                ultima_fecha_completada: null,
                actualizado_en: "2026-11-14T00:00:00Z"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // Guardar misión 1
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Guardar misión 2
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Consultar estado previo del día
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Guardar resumen del día
        .mockResolvedValueOnce(new Response("[]", { status: 200 }));

      const resultado = await missionsController.sincronizarProgresoMisionesPut(mockReq, {
        fecha: "2026-11-14",
        misiones: [
          { misionId: "checkin-diario", completada: true, valorActual: 1, valorObjetivo: 1 },
          { misionId: "tierra-pasos-media", completada: false, valorActual: 3000, valorObjetivo: 7000 }
        ]
      });

      expect(resultado.totalMisiones).toBe(2);
      expect(resultado.misionesCompletadas).toBe(1);
      expect(resultado.todasCompletadas).toBe(false);
      expect(resultado.puntoRachaOtorgado).toBe(false);
      expect(resultado.racha.rachaActual).toBe(0);
      mockFetch.mockRestore();
    });

    it("otorga 1 punto de racha y acumula en la base de datos cuando TODAS las misiones del día se completan", async () => {
      // Simular racha previa de 3 días donde ayer se completó
      const mockFetch = jest
        .spyOn(global, "fetch")
        // Guardar misión 1
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Guardar misión 2
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Consultar si ya se había otorgado punto hoy (no, punto_racha_otorgado: false)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([{ punto_racha_otorgado: false }]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // Consultar racha actual (racha = 3, última completada: ayer 2026-11-13)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                user_id: mockUserId,
                racha_actual: 3,
                racha_maxima: 5,
                total_dias_completados: 3,
                ultima_fecha_completada: "2026-11-13",
                actualizado_en: "2026-11-13T20:00:00Z"
              }
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
        // Guardar nueva racha (upsert a astronaut_streaks)
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        // Guardar resumen del día (upsert a daily_mission_days)
        .mockResolvedValueOnce(new Response("[]", { status: 200 }));

      const resultado = await missionsController.sincronizarProgresoMisionesPut(mockReq, {
        fecha: "2026-11-14",
        misiones: [
          { misionId: "checkin-diario", completada: true, valorActual: 1, valorObjetivo: 1 },
          { misionId: "tierra-pasos-media", completada: true, valorActual: 7000, valorObjetivo: 7000 }
        ]
      });

      expect(resultado.totalMisiones).toBe(2);
      expect(resultado.misionesCompletadas).toBe(2);
      expect(resultado.todasCompletadas).toBe(true);
      expect(resultado.puntoRachaOtorgado).toBe(true);
      // Racha previa era 3 y hoy completó todas: pasa a 4 días
      expect(resultado.racha.rachaActual).toBe(4);
      expect(resultado.racha.totalDiasCompletados).toBe(4);
      expect(resultado.racha.ultimaFechaCompletada).toBe("2026-11-14");
      expect(resultado.racha.todasCompletadasHoy).toBe(true);
      mockFetch.mockRestore();
    });
  });
});
