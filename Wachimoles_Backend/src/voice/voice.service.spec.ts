import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VoiceService } from "./voice.service";

const reply = (content: string, ok = true) =>
  jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 402,
    text: async () => "Insufficient Balance",
    json: async () => ({ choices: [{ message: { content } }] })
  });

describe("VoiceService", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });
  const make = (env: Record<string, string> = { DEEPSEEK_API_KEY: "k" }) =>
    new VoiceService(new ConfigService(env));

  it("is unavailable without an API key", async () => {
    await expect(make({}).interpret("hola")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("maps a model reply to a sanitized intent and calls DeepSeek with the key", async () => {
    const fetchMock = reply('{"type":"body-zone","muscleId":"dorsal_izq"}');
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await make().interpret("me duele la espalda de la izquierda");
    expect(result.intent).toEqual({ type: "body-zone", muscleId: "dorsal_izq", muscleName: "Dorsal izquierdo" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer k");
  });

  it("asks the model to answer in the app language (Spanish by default)", async () => {
    const fetchMock = reply('{"type":"help"}');
    global.fetch = fetchMock as unknown as typeof fetch;
    await make().interpret("hola");
    await make().interpret("hello", "en");
    const system = (i: number) =>
      JSON.parse(fetchMock.mock.calls[i][1].body).messages[0].content as string;
    expect(system(0)).toContain("siempre en español");
    expect(system(1)).toContain("siempre en inglés");
  });

  it("sends system, history in order, then the current text", async () => {
    const fetchMock = reply('{"type":"help"}');
    global.fetch = fetchMock as unknown as typeof fetch;
    const history = [
      { role: "user" as const, content: "me duele el bíceps" },
      { role: "assistant" as const, content: "¿derecho o izquierdo?" }
    ];
    await make().interpret("el derecho", "es", history);
    const messages = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("system");
    expect(messages.slice(1)).toEqual([...history, { role: "user", content: "el derecho" }]);
  });

  it("sends only system + user when there is no history", async () => {
    const fetchMock = reply('{"type":"help"}');
    global.fetch = fetchMock as unknown as typeof fetch;
    await make().interpret("hola");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toHaveLength(2);
  });

  it("returns the clarification message when the model has no action", async () => {
    global.fetch = reply('{"type":"unknown","message":"¿Qué lado?"}') as unknown as typeof fetch;
    expect(await make().interpret("bíceps")).toEqual({ intent: null, message: "¿Qué lado?" });
  });

  it("ignores malformed or hostile model output", async () => {
    global.fetch = reply("not json") as unknown as typeof fetch;
    expect((await make().interpret("x")).intent).toBeNull();
    global.fetch = reply('{"type":"body-zone","muscleId":"nope"}') as unknown as typeof fetch;
    expect((await make().interpret("x")).intent).toBeNull();
  });

  it("maps upstream failures to 502", async () => {
    global.fetch = reply("{}", false) as unknown as typeof fetch;
    await expect(make().interpret("x")).rejects.toBeInstanceOf(BadGatewayException);
    global.fetch = jest.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    await expect(make().interpret("x")).rejects.toBeInstanceOf(BadGatewayException);
  });
});
