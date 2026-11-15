import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { SaveBodyProfileDto, WeightsQueryDto } from "./weights.dto";
import { WeightsService } from "./weights.service";

const userId = "46f18439-ff31-4e31-ae49-246d5724f134";

function createService(): WeightsService {
  return new WeightsService(
    new ConfigService({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-secret"
    })
  );
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const weightRows = [
  {
    id: 2,
    measurement_id: "weight-1794190000000",
    weight_kg: 78.65,
    device: "okok-scale",
    measured_at: "2026-11-14T21:00:00.000Z",
    received_at: "2026-11-14T21:00:02.000Z"
  }
];
const profileRow = {
  height_cm: "172.0", // PostgREST puede devolver numeric como texto
  age_years: 21,
  sex: "male",
  updated_at: "2026-11-14T20:00:00.000Z"
};

function mockSupabase(profile: unknown[]) {
  return jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    return url.pathname.endsWith("/weight_measurements")
      ? json(weightRows)
      : json(profile);
  });
}

describe("WeightsService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("scopes queries to the active user, uses the server key and adds metrics", async () => {
    const fetchMock = mockSupabase([profileRow]);

    const weights = await createService().getWeights(userId, 10);

    const weightCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/weight_measurements")
    );
    const url = new URL(String(weightCall?.[0]));
    const headers = new Headers(weightCall?.[1]?.headers);
    expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
    expect(url.searchParams.get("limit")).toBe("10");
    expect(headers.get("Authorization")).toBe("Bearer server-secret");
    expect(weights[0]).toMatchObject({
      measurementId: "weight-1794190000000",
      weightKg: 78.65,
      device: "okok-scale"
    });
    expect(weights[0].metrics?.exact.bmi).toBeCloseTo(26.59, 2);
    expect(weights[0].metrics?.exact.idealWeightKg).toBe(64.4);
    expect(weights[0].metrics?.estimated?.bodyFatPercent).toBeGreaterThan(0);
  });

  it("works with a profile that only has the height", async () => {
    mockSupabase([
      { height_cm: 177, age_years: null, sex: null, updated_at: "2026-11-14T20:00:00.000Z" }
    ]);
    const weights = await createService().getWeights(userId);
    expect(weights[0].metrics?.exact.bmi).toBeCloseTo(25.1, 1); // 78.65 kg / 1.77 m ^ 2
    expect(weights[0].metrics?.exact.idealWeightKg).toBeNull();
    expect(weights[0].metrics?.estimated).toBeNull();
  });

  it("returns weights without metrics while there is no body profile", async () => {
    mockSupabase([]);
    const weights = await createService().getWeights(userId);
    expect(weights).toHaveLength(1);
    expect(weights[0].metrics).toBeNull();
  });

  it("saves a height-only profile as nulls, never inventing age or sex", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      json([{ height_cm: 177, age_years: null, sex: null, updated_at: "2026-11-14T20:00:00.000Z" }])
    );
    const saved = await createService().saveBodyProfile(userId, { heightCm: 177 });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ user_id: userId, height_cm: 177, age_years: null, sex: null });
    expect(saved).toMatchObject({ heightCm: 177, ageYears: null, sex: null });
  });

  it("upserts the profile for the active user, not for a user given by the client", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(json([{ ...profileRow, height_cm: 172 }]));

    const saved = await createService().saveBodyProfile(userId, {
      heightCm: 172,
      ageYears: 21,
      sex: "male"
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(url.searchParams.get("on_conflict")).toBe("user_id");
    expect(body).toMatchObject({
      user_id: userId,
      height_cm: 172,
      age_years: 21,
      sex: "male"
    });
    expect(saved).toMatchObject({ heightCm: 172, ageYears: 21, sex: "male" });
  });

  it("fails with 503 when the database errors or returns an unexpected shape", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(json({ code: "42P01" }, 404));
    await expect(createService().getWeights(userId)).rejects.toThrow(
      /could not be loaded/
    );

    jest.restoreAllMocks();
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input) =>
        String(input).includes("/weight_measurements")
          ? json([{ id: 1, weight_kg: "bad" }])
          : json([])
      );
    await expect(createService().getWeights(userId)).rejects.toThrow(
      /invalid weight response/
    );
  });
});

describe("weights DTOs", () => {
  const errors = (cls: new () => object, plain: object) =>
    validateSync(plainToInstance(cls, plain)).length;

  it("accepts a valid body profile and rejects out-of-range values", () => {
    expect(errors(SaveBodyProfileDto, { heightCm: 172, ageYears: 21, sex: "male" })).toBe(0);
    expect(errors(SaveBodyProfileDto, { heightCm: 177 })).toBe(0); // edad y sexo opcionales
    expect(errors(SaveBodyProfileDto, { heightCm: 20, ageYears: 21, sex: "male" })).toBeGreaterThan(0);
    expect(errors(SaveBodyProfileDto, { heightCm: 172, ageYears: 2, sex: "male" })).toBeGreaterThan(0);
    expect(errors(SaveBodyProfileDto, { heightCm: 172, ageYears: 21, sex: "x" })).toBeGreaterThan(0);
  });

  it("limits the weights query", () => {
    expect(errors(WeightsQueryDto, { limit: "50" })).toBe(0);
    expect(errors(WeightsQueryDto, { limit: "0" })).toBeGreaterThan(0);
    expect(errors(WeightsQueryDto, { limit: "501" })).toBeGreaterThan(0);
  });
});
