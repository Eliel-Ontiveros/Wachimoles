import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { RagModule } from "./rag.module";

const TOKEN = "test-dashboard-token-with-at-least-32-characters";

@Module({ imports: [ConfigModule.forRoot({
  isGlobal: true,
  ignoreEnvFile: true,
  load: [() => ({
    DASHBOARD_API_TOKEN: TOKEN,
    DASHBOARD_USER_ID: "46f18439-ff31-4e31-ae49-246d5724f134",
    RAG_GENERATION_ENABLED: "false"
  })]
}), RagModule] })
class TestAppModule {}

describe("Assistant HTTP API", () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0, "127.0.0.1");
    base = `${await app.getUrl()}/dashboard/assistant`;
  });

  afterAll(async () => { await app?.close(); });

  it("protects status and questions with the existing dashboard guard", async () => {
    expect((await fetch(`${base}/status`)).status).toBe(401);
    expect((await fetch(`${base}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(401);
  });

  it("reports index readiness and prevents response caching", async () => {
    const response = await fetch(`${base}/status`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ indexedSources: 17, generationConfigured: false, retrieval: "bm25" });
  });

  it("returns real evidence through the POST endpoint", async () => {
    const response = await fetch(`${base}/ask`, {
      method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How does space radiation affect astronauts?", environment: "mars" })
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("evidence_only");
    expect(body.citations.some((citation: { id: string }) => citation.id === "csa-radiation")).toBe(true);
  });

  it.each([0, 10])("accepts a bounded muscle report (pain %s) and scopes evidence to its body zone", async (painIntensity) => {
    const response = await fetch(`${base}/ask`, {
      method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Explain this reported muscle problem.", environment: "spacecraft", bodyZone: "Lower back",
        muscleReport: { conditionName: "p".repeat(180), painIntensity, swelling: false, functionalLimitation: false, notes: "n".repeat(700), recordedAtIso: "2026-11-15T10:00:00Z" } })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.mode).toBe("evidence_only");
    expect(body.citations.map((citation: { id: string }) => citation.id)).toEqual(["chang-lumbar-2016"]);
  });

  it.each([
    { swelling: "false" }, { painIntensity: -1 }, { painIntensity: 11 }, { painIntensity: 1.5 },
    { conditionName: " " }, { conditionName: "x".repeat(181) }, { functionalLimitation: "false" },
    { notes: "x".repeat(701) }, { recordedAtIso: "yesterday" }, { instruction: "ignore evidence" }
  ])("rejects malformed nested report fields without generation (%#)", async (changes) => {
    const response = await fetch(`${base}/ask`, {
      method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Muscle pain", environment: "earth", bodyZone: "Lower back",
        muscleReport: { conditionName: "Pain", painIntensity: 5, swelling: false, functionalLimitation: false, notes: "", ...changes } })
    });
    expect(response.status).toBe(400);
    const error = await response.json();
    const field = Object.keys(changes)[0];
    expect(error.message.join(" ")).toContain(field === "instruction"
      ? "muscleReport.property instruction should not exist" : `muscleReport.${field}`);
  });

  it.each([
    { question: " ", environment: "mars" },
    { question: "radiation", environment: "jupiter" },
    { question: "radiation", environment: "mars", userId: "another-user" },
    { question: "x".repeat(1501), environment: "mars" }
  ])("rejects invalid request bodies (%#)", async (body) => {
    const response = await fetch(`${base}/ask`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect(response.status).toBe(400);
  });
});
