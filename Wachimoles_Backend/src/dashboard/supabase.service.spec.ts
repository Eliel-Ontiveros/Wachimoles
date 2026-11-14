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

  it("accepts sleep samples in the dashboard history", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 9,
            sample_id: "sleep-2026-11-11",
            metric: "sleep",
            value: 7.25,
            unit: "hours",
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

    const samples = await service.getSamples(
      "46f18439-ff31-4e31-ae49-246d5724f134",
      { metric: "sleep" }
    );

    expect(samples).toEqual([
      {
        id: 9,
        sampleId: "sleep-2026-11-11",
        metric: "sleep",
        value: 7.25,
        unit: "hours",
        measuredAt: "2026-11-11T10:00:00.000Z",
        receivedAt: "2026-11-11T10:00:02.000Z"
      }
    ]);
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

  it("uploads a validated body-condition image and returns a short-lived URL", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockImplementationOnce(async (input) => {
        const requestedUrl = new URL(String(input));
        return new Response(
          JSON.stringify({
            signedURL: `${requestedUrl.pathname.replace(
              "/storage/v1/object/sign/",
              "/object/sign/"
            )}?token=signed`
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret",
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";
    const fileBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ]);

    const image = await service.uploadBodyConditionImage(userId, "deltoides_der", {
      buffer: fileBuffer,
      mimetype: "image/png",
      size: fileBuffer.length
    });

    const uploadUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const uploadHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    const signUrl = new URL(String(fetchMock.mock.calls[1][0]));
    const signHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(uploadUrl.pathname).toMatch(
      /^\/storage\/v1\/object\/Wachimoles%20Images\/46f18439-ff31-4e31-ae49-246d5724f134\/deltoides_der\/[0-9a-f-]+\.png$/
    );
    expect(uploadHeaders.get("Authorization")).toBe("Bearer server-secret");
    expect(uploadHeaders.get("Content-Type")).toBe("image/png");
    expect(signUrl.pathname).toBe(
      `/storage/v1/object/sign/Wachimoles%20Images/${image.path}`
    );
    expect(signHeaders.get("Authorization")).toBe("Bearer server-secret");
    expect(image.signedUrl).toContain("?token=signed");
    expect(image.expiresAt).toEqual(expect.any(String));
  });

  it("lists only the requested user's muscle images with signed URLs", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ name: "c2d7ac29-07d2-48c7-8fd1-cde56881b08e.png" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockImplementationOnce(async (input) => {
        const requestedUrl = new URL(String(input));
        return new Response(
          JSON.stringify({
            signedURL: `${requestedUrl.pathname.replace(
              "/storage/v1/object/sign/",
              "/object/sign/"
            )}?token=signed`
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret",
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

    const images = await service.getBodyConditionImages(userId, "deltoides_der");

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const sentBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body)
    ) as Record<string, unknown>;
    expect(requestedUrl.pathname).toBe(
      "/storage/v1/object/list/Wachimoles%20Images"
    );
    expect(sentBody.prefix).toBe(`${userId}/deltoides_der/`);
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe(
      `${userId}/deltoides_der/c2d7ac29-07d2-48c7-8fd1-cde56881b08e.png`
    );
    expect(images[0].signedUrl).toContain("?token=signed");
  });

  it("deletes only an image inside the requested user's muscle folder", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret",
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      })
    );
    const userId = "46f18439-ff31-4e31-ae49-246d5724f134";
    const fileName = "c2d7ac29-07d2-48c7-8fd1-cde56881b08e.png";

    await expect(
      service.deleteBodyConditionImage(userId, "deltoides_der", fileName)
    ).resolves.toEqual({ deleted: true });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const sentBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body)
    ) as { prefixes: string[] };
    expect(requestedUrl.pathname).toBe(
      "/storage/v1/object/Wachimoles%20Images"
    );
    expect(sentBody.prefixes).toEqual([
      `${userId}/deltoides_der/${fileName}`
    ]);
  });

  it("rejects images whose content does not match the declared image type", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret",
        SUPABASE_STORAGE_BUCKET: "Wachimoles Images"
      })
    );

    await expect(
      service.uploadBodyConditionImage("user-id", "deltoides_der", {
        buffer: Buffer.from("not an image"),
        mimetype: "image/png",
        size: 12
      })
    ).rejects.toThrow("Only valid JPEG, PNG, and WebP images are supported.");
    expect(fetchMock).not.toHaveBeenCalled();
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
