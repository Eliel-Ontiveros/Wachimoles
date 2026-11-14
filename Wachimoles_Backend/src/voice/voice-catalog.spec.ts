import { allCatalogActions, buildSystemPrompt, SCREENS } from "./voice-catalog";
import { INTENT_TYPES, sanitizeIntent } from "./voice-intent";

describe("voice catalog", () => {
  it("every example intent passes sanitizeIntent with the same type", () => {
    for (const action of allCatalogActions()) {
      expect(action.examples.length).toBeGreaterThan(0);
      for (const ex of action.examples) {
        expect(ex.intent.type).toBe(action.type);
        expect(sanitizeIntent(ex.intent)?.type).toBe(action.type);
      }
    }
  });

  it("covers every intent type sanitizeIntent accepts, and nothing else", () => {
    const types = new Set(allCatalogActions().map((a) => a.type));
    for (const t of INTENT_TYPES) expect(types.has(t)).toBe(true);
    for (const t of types) expect(INTENT_TYPES).toContain(t);
  });

  it("describes the three screens", () => {
    expect(SCREENS.map((s) => s.route)).toEqual(["/", "/explore", "/missions"]);
    for (const s of SCREENS) expect(s.shows.length).toBeGreaterThan(0);
  });
});

describe("buildSystemPrompt", () => {
  it("lists every intent type and the language line", () => {
    const p = buildSystemPrompt("en");
    for (const t of INTENT_TYPES) expect(p).toContain(t);
    expect(p).toContain("siempre en inglés");
    expect(buildSystemPrompt()).toContain("siempre en español");
    expect(p).not.toContain("El usuario está en");
  });

  it("includes the context screen title and tab", () => {
    const p = buildSystemPrompt("es", { screen: "/explore", tab: "records" });
    expect(p).toContain("El usuario está en Vista Corporal (Registros)");
    expect(p).toContain("prefiere acciones de esta pantalla");
    expect(buildSystemPrompt("es", { screen: "/missions" })).toContain("El usuario está en Misiones y Viaje.");
  });
});
