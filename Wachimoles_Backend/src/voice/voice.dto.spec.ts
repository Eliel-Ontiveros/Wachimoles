import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { InterpretVoiceDto } from "./voice.dto";

const check = (plain: unknown) =>
  validateSync(plainToInstance(InterpretVoiceDto, plain), {
    whitelist: true,
    forbidNonWhitelisted: true
  });

const turn = (i: number) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` });

describe("InterpretVoiceDto history", () => {
  it("accepts a valid history and no history", () => {
    expect(check({ text: "hola" })).toHaveLength(0);
    expect(check({ text: "hola", history: [turn(0), turn(1)] })).toHaveLength(0);
    expect(check({ text: "hola", history: Array.from({ length: 6 }, (_, i) => turn(i)) })).toHaveLength(0);
  });

  it("rejects more than 6 items", () => {
    expect(check({ text: "hola", history: Array.from({ length: 7 }, (_, i) => turn(i)) }).length).toBeGreaterThan(0);
  });

  it("rejects a bad role", () => {
    expect(check({ text: "hola", history: [{ role: "system", content: "x" }] }).length).toBeGreaterThan(0);
  });

  it("rejects empty or too long content", () => {
    expect(check({ text: "hola", history: [{ role: "user", content: "a".repeat(301) }] }).length).toBeGreaterThan(0);
    expect(check({ text: "hola", history: [{ role: "user", content: "" }] }).length).toBeGreaterThan(0);
  });

  it("rejects extra keys in items", () => {
    expect(check({ text: "hola", history: [{ role: "user", content: "x", extra: 1 }] }).length).toBeGreaterThan(0);
  });
});

describe("InterpretVoiceDto context", () => {
  it("accepts a valid or missing context", () => {
    expect(check({ text: "hola", context: { screen: "/" } })).toHaveLength(0);
    expect(check({ text: "hola", context: { screen: "/explore", tab: "records" } })).toHaveLength(0);
  });

  it("rejects bad screen, bad tab, unknown keys and non-objects", () => {
    expect(check({ text: "hola", context: { screen: "/x" } }).length).toBeGreaterThan(0);
    expect(check({ text: "hola", context: {} }).length).toBeGreaterThan(0);
    expect(check({ text: "hola", context: { screen: "/", tab: "nope" } }).length).toBeGreaterThan(0);
    expect(check({ text: "hola", context: { screen: "/", extra: 1 } }).length).toBeGreaterThan(0);
    expect(check({ text: "hola", context: "/" }).length).toBeGreaterThan(0);
  });
});
