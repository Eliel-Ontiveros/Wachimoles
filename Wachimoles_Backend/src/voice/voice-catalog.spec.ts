import { allCatalogActions, buildSystemPrompt, SCREENS } from "./voice-catalog";
import { INTENT_TYPES, sanitizeIntent, TABS } from "./voice-intent";

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
  it("lists every intent type and requires English messages", () => {
    const p = buildSystemPrompt();
    for (const t of INTENT_TYPES) expect(p).toContain(t);
    expect(p).toContain("The user may speak Spanish or English; understand both");
    expect(p).toContain('the `message` field must ALWAYS be in English');
    expect(p).not.toContain("siempre en español");
    expect(p).not.toContain("El usuario está en");
  });

  it("includes the context screen title and tab in English", () => {
    const p = buildSystemPrompt({ screen: "/explore", tab: "records" });
    expect(p).toContain("The user is on Body View (Records)");
    expect(p).toContain("prefer actions from this screen");
    expect(buildSystemPrompt({ screen: "/missions" })).toContain("The user is on Missions & Journey.");
  });

  it("uses English screen titles and tabs", () => {
    expect(SCREENS.map((s) => s.title)).toEqual(["Vital Monitoring", "Body View", "Missions & Journey"]);
    expect(Object.values(TABS)).toEqual(["3D View", "Questionnaire", "Records"]);
  });

  it("has no Spanish instructions in the prompt", () => {
    expect(buildSystemPrompt()).not.toMatch(/Eres el|Responde SOLO|Nunca inventes/);
  });
});
