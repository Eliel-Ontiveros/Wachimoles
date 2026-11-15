import * as corpusData from "./corpus.json";
import { retrieveMuscleEvidence } from "./muscle-retrieval";
import { RagCorpus } from "./rag.types";

describe("Structured symptom retrieval", () => {
  const source = corpusData.sources[0];
  const passages = [
    ["pain", "Shoulder pain general findings"],
    ["swelling", "Shoulder pain swelling findings"],
    ["limitation", "Shoulder pain limited movement findings"],
    ["wrong-region", "Lumbar pain swelling limited movement findings"],
  ];
  const corpus: RagCorpus = {
    version: 1,
    sources: passages.map(([id]) => ({ ...source, id, title: "Research findings" })),
    chunks: passages.map(([id, text]) => ({ id, sourceId: id, wordOffset: 0, text })),
  };
  const report = { conditionName: "Pain", painIntensity: 5, swelling: false, functionalLimitation: false, notes: "" };

  it.each([
    [{}, "pain"],
    [{ swelling: true }, "swelling"],
    [{ functionalLimitation: true }, "limitation"],
  ])("only boosts symptoms actually reported (%#)", (changes, expectedFirst) => {
    const results = retrieveMuscleEvidence(corpus, { ...report, ...changes }, "Right deltoid", "spacecraft");
    expect(results[0].id).toBe(expectedFirst);
    expect(results.map((citation) => citation.id)).not.toContain("wrong-region");
    expect(results.every((citation) => citation.excerpt === passages.find(([id]) => id === citation.id)?.[1])).toBe(true);
  });

  it.each(["Left hamstrings (Back of leg)", "lower leg", "Upper arm", "Left hand", "Left thigh (Quadriceps)"])(
    "rejects generic anatomical tokens in unsupported region %s", (zone) => {
      const results = retrieveMuscleEvidence(corpusData, report, zone, "spacecraft");
      expect(results).toEqual([]);
    },
  );

  it("cannot use notes or the environment to supply a missing body-region match", () => {
    expect(retrieveMuscleEvidence(corpus, { ...report, notes: "shoulder pain" }, "Right biceps", "spacecraft")).toEqual([]);
    expect(retrieveMuscleEvidence(corpus, report, "", "shoulder")).toEqual([]);
  });
});
