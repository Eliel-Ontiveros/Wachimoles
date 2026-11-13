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
});
