import { ConfigService } from "@nestjs/config";
import { validate } from "class-validator";
import * as corpusData from "./corpus.json";
import { AskRagDto } from "./rag.dto";
import { parseGroundedAnswer, RagService } from "./rag.service";
import { RagCorpus } from "./rag.types";
import { retrieve } from "./retrieval";

const corpus: RagCorpus = corpusData;
const question: AskRagDto = { question: "How does space radiation affect astronauts?", environment: "mars" };

describe("RAG over the curated challenge corpus", () => {
  afterEach(() => jest.restoreAllMocks());

  it("indexes all five sources with provenance and bounded passages", () => {
    expect(corpus.sources).toHaveLength(5);
    for (const source of corpus.sources) {
      expect(source.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(Number.isFinite(Date.parse(source.retrievedAt))).toBe(true);
      expect(corpus.chunks.some((chunk) => chunk.sourceId === source.id)).toBe(true);
    }
    for (const chunk of corpus.chunks) expect(chunk.text.split(/\s+/).length).toBeLessThanOrEqual(350);
  });

  it.each([
    ["What are the five hazards of human spaceflight?", "nasa-hazards"],
    [question.question, "csa-radiation"],
    ["Why are bone and muscle changes studied in space?", "nasa-risks"],
    ["How is sleep studied in space?", "nasa-research"]
  ])("retrieves evidence for %s", (query, expectedSource) => {
    const evidence = retrieve(corpus, query, "mars");
    expect(evidence.map((item) => item.id)).toContain(expectedSource);
    expect(evidence.length).toBeLessThanOrEqual(4);
    for (const item of evidence) expect(item.excerpt).toBe(corpus.chunks.find((chunk) => chunk.id === item.chunkId)?.text);
  });

  it("does not let mission context supply evidence for an unrelated question", () => {
    expect(retrieve(corpus, "How do I configure a Kubernetes cluster?", "mars radiation bone")).toEqual([]);
  });

  it("does not call DeepSeek in retrieval-only mode or when evidence is absent", async () => {
    const fetch = jest.spyOn(global, "fetch");
    const service = new RagService(new ConfigService({ DEEPSEEK_API_KEY: "test-secret" }));
    expect((await service.ask(question)).mode).toBe("evidence_only");
    expect((await service.ask({ ...question, question: "What dose of aspirin should I take?" })).mode).toBe("insufficient_evidence");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends only selected context and retrieved passages to DeepSeek, and returns validated references", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ statements: [{ text: "The resource describes an instrument for neutron radiation monitoring.", sourceIds: [1] }] }) } }]
    }), { status: 200 }));
    const service = new RagService(new ConfigService({ DEEPSEEK_API_KEY: "test-secret", RAG_GENERATION_ENABLED: "true" }));
    const answer = await service.ask(question);
    expect(answer.mode).toBe("generated");
    expect(answer.answer).toContain("[1]");
    expect(fetch.mock.calls[0][0]).toBe("https://api.deepseek.com/chat/completions");
    const request = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    const data = JSON.parse(request.messages[1].content);
    expect(data.selectedEnvironment).toBe("mars");
    expect(data.evidence).toHaveLength(answer.citations.length);
    expect(JSON.stringify(data)).not.toContain("test-secret");
    expect(request.response_format).toEqual({ type: "json_object" });
  });

  it.each([
    new Response("quota exceeded", { status: 429 }),
    new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })),
    new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: " " } }] })),
    new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ statements: [{ text: "Unsupported reference", sourceIds: [99] }] }) } }] }))
  ])("falls back to real passages when synthesis cannot be trusted (%#)", async (response) => {
    jest.spyOn(global, "fetch").mockResolvedValue(response);
    const service = new RagService(new ConfigService({ DEEPSEEK_API_KEY: "test-secret", RAG_GENERATION_ENABLED: "true" }));
    const answer = await service.ask(question);
    expect(answer.mode).toBe("generation_unavailable");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answer).not.toContain("Unsupported reference");
  });

  it("rejects fabricated URLs and missing source IDs, and supports model abstention", () => {
    const citations = retrieve(corpus, question.question, "mars");
    expect(() => parseGroundedAnswer('{"statements":[{"text":"https://fake.example","sourceIds":[1]}]}', citations)).toThrow();
    expect(() => parseGroundedAnswer('{"statements":[{"text":"A claim","sourceIds":[]}]}', citations)).toThrow();
    expect(parseGroundedAnswer('{"statements":[]}', citations)).toBeNull();
  });

  it("validates blank/oversize questions and unknown environments", async () => {
    const body = Object.assign(new AskRagDto(), { question: "   ", environment: "jupiter" });
    expect((await validate(body)).map((error) => error.property)).toEqual(expect.arrayContaining(["question", "environment"]));
    body.question = "x".repeat(1501);
    expect((await validate(body)).map((error) => error.property)).toContain("question");
  });
});
