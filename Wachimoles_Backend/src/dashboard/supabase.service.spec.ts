import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "./supabase.service";

describe("SupabaseService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("scopes sample queries to the configured user and uses the server key", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 8,
            sample_id: "steps-2026-11-11",
            metric: "steps",
            value: 1200,
            unit: "steps",
            measured_at: "2026-11-11T10:00:00.000Z",
            received_at: "2026-11-11T10:00:02.000Z"
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const samples = await service.getSamples(userId, {
      limit: 25,
      metric: "steps"
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(requestedUrl.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(requestedUrl.searchParams.get("metric")).toBe("eq.steps");
    expect(requestedUrl.searchParams.get("limit")).toBe("25");
    expect(headers.get("Authorization")).toBe("Bearer server-secret");
    expect(headers.get("apikey")).toBe("server-secret");
    expect(samples[0].sampleId).toBe("steps-2026-11-11");
  });

  it("upserts the user's body condition and maps the database row", async () => {
    const row = {
      id: "c2d7ac29-07d2-48c7-8fd1-cde56881b08e",
      muscle_id: "deltoides_der",
      body_region: "Extremidad superior",
      muscle_name: "Deltoides derecho",
      condition_name: "Dolor muscular",
      description: "Molestia al levantar el brazo",
      pain_intensity: 6,
      swelling: false,
      functional_limitation: true,
      status: "active",
      recorded_at: "2026-11-13T10:00:00.000Z",
      created_at: "2026-11-12T10:00:00.000Z",
      updated_at: "2026-11-13T10:00:00.000Z",
      resolved_at: null
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([row]), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      })
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const condition = await service.saveBodyCondition(userId, row.muscle_id, {
      bodyRegion: "Extremidad superior",
      muscleName: "Deltoides derecho",
      conditionName: "Dolor muscular",
      description: "Molestia al levantar el brazo",
      painIntensity: 6,
      swelling: false,
      functionalLimitation: true
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const request = fetchMock.mock.calls[0][1];
    const headers = new Headers(request?.headers);
    const sentBody = JSON.parse(String(request?.body)) as Record<
      string,
      unknown
    >;
    expect(request?.method).toBe("POST");
    expect(requestedUrl.searchParams.get("on_conflict")).toBe(
      "user_id,muscle_id"
    );
    expect(sentBody.user_id).toBe(userId);
    expect(sentBody.muscle_id).toBe(row.muscle_id);
    expect(sentBody.pain_intensity).toBe(6);
    expect(headers.get("Authorization")).toBe("Bearer server-secret");
    expect(headers.get("Prefer")).toContain("resolution=merge-duplicates");
    expect(condition.muscleId).toBe(row.muscle_id);
    expect(condition.recordedAt).toBe(row.recorded_at);
  });

  it("lists body conditions scoped to the configured user", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "c2d7ac29-07d2-48c7-8fd1-cde56881b08e",
            muscle_id: "deltoides_der",
            body_region: "Extremidad superior",
            muscle_name: "Deltoides derecho",
            condition_name: "Dolor muscular",
            description: null,
            pain_intensity: 4,
            swelling: false,
            functional_limitation: false,
            status: "resolved",
            recorded_at: "2026-11-13T10:00:00.000Z",
            created_at: "2026-11-12T10:00:00.000Z",
            updated_at: "2026-11-13T10:00:00.000Z",
            resolved_at: "2026-11-13T11:00:00.000Z"
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const conditions = await service.getBodyConditions(userId, { limit: 50 });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(requestedUrl.searchParams.get("limit")).toBe("50");
    expect(conditions[0].status).toBe("resolved");
    expect(conditions[0].resolvedAt).toBe("2026-11-13T11:00:00.000Z");
  });

  it("resolves only the configured user's active body condition", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    await service.resolveBodyCondition(userId, "deltoides_der");

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const request = fetchMock.mock.calls[0][1];
    const sentBody = JSON.parse(String(request?.body)) as Record<
      string,
      unknown
    >;
    expect(request?.method).toBe("PATCH");
    expect(requestedUrl.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(requestedUrl.searchParams.get("muscle_id")).toBe(
      "eq.deltoides_der"
    );
    expect(requestedUrl.searchParams.get("status")).toBe("eq.active");
    expect(sentBody.status).toBe("resolved");
    expect(sentBody.resolved_at).toEqual(expect.any(String));
  });

  it("upserts the daily check for the configured user and maps its measurements", async () => {
    const row = {
      id: "dd7f1e4a-9aa4-49eb-9848-f1b01ec09b1c",
      date_iso: "2026-11-13",
      blood_sugar_mg_dl: 105,
      systolic_bp: 118,
      diastolic_bp: 76,
      temperature_c: 36.7,
      sleep_hours: 7.5,
      mood: 4,
      symptoms: ["Fatiga"],
      notes: "Sin molestias adicionales",
      overall_status: "normal",
      recommendation: "Indicadores dentro de parámetros esperados.",
      recorded_at: "2026-11-13T10:00:00.000Z",
      created_at: "2026-11-13T09:00:00.000Z",
      updated_at: "2026-11-13T10:00:00.000Z"
    };
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([row]), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      })
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const check = await service.saveDailyHealthCheck(userId, row.date_iso, {
      bloodSugarMgDl: 105,
      systolicBp: 118,
      diastolicBp: 76,
      temperatureC: 36.7,
      sleepHours: 7.5,
      mood: 4,
      symptoms: ["Fatiga"],
      notes: "Sin molestias adicionales",
      overallStatus: "normal",
      recommendation: "Indicadores dentro de parámetros esperados."
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const request = fetchMock.mock.calls[0][1];
    const headers = new Headers(request?.headers);
    const sentBody = JSON.parse(String(request?.body)) as Record<
      string,
      unknown
    >;
    expect(request?.method).toBe("POST");
    expect(requestedUrl.pathname).toBe("/rest/v1/daily_health_checks");
    expect(requestedUrl.searchParams.get("on_conflict")).toBe(
      "user_id,date_iso"
    );
    expect(sentBody.user_id).toBe(userId);
    expect(sentBody.date_iso).toBe(row.date_iso);
    expect(sentBody.systolic_bp).toBe(118);
    expect(sentBody.recorded_at).toEqual(expect.any(String));
    expect(headers.get("Authorization")).toBe("Bearer server-secret");
    expect(check.dateIso).toBe(row.date_iso);
    expect(check.temperatureC).toBe(36.7);
    expect(check.symptoms).toEqual(["Fatiga"]);
  });

  it("lists daily checks scoped to the configured user", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "dd7f1e4a-9aa4-49eb-9848-f1b01ec09b1c",
            date_iso: "2026-11-13",
            blood_sugar_mg_dl: null,
            systolic_bp: null,
            diastolic_bp: null,
            temperature_c: null,
            sleep_hours: null,
            mood: 4,
            symptoms: ["Ninguno"],
            notes: null,
            overall_status: "normal",
            recommendation: "Todo normal.",
            recorded_at: "2026-11-13T10:00:00.000Z",
            created_at: "2026-11-13T10:00:00.000Z",
            updated_at: "2026-11-13T10:00:00.000Z"
          }
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const checks = await service.getDailyHealthChecks(userId, { limit: 30 });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(requestedUrl.searchParams.get("limit")).toBe("30");
    expect(checks[0].bloodSugarMgDl).toBeNull();
    expect(checks[0].recordedAt).toBe("2026-11-13T10:00:00.000Z");
  });
});
