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
    expect(await response.json()).toMatchObject({ indexedSources: 5, generationConfigured: false, retrieval: "bm25" });
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
