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
    results.forEach((citation) => expect(citation).toHaveProperty("evidenceScope", "region_specific"));
    expect(results.map((citation) => citation.id)).not.toContain("wrong-region");
    expect(results.every((citation) => citation.excerpt === passages.find(([id]) => id === citation.id)?.[1])).toBe(true);
  });

  it.each(["Right biceps", "Left hamstrings (Back of leg)", "lower leg", "Upper arm", "Left hand", "Left thigh (Quadriceps)", ""])(
    "offers labelled general evidence without borrowing another region for %s", (zone) => {
      const results = retrieveMuscleEvidence(corpusData, report, zone, "spacecraft");
      expect(results.length).toBeGreaterThan(0);
      results.forEach((citation) => expect(citation).toHaveProperty("evidenceScope", "general"));
      expect(results.map((citation) => citation.id)).not.toContain("chang-lumbar-2016");
      expect(results.map((citation) => citation.id)).not.toContain("nasa-shoulder-2025");
      for (const citation of results) {
        expect(citation.excerpt).toBe(corpusData.chunks.find((chunk) => chunk.id === citation.chunkId)?.text);
      }
    },
  );

  it("adds general movement research only when functional limitation is reported", () => {
    const sources = (functionalLimitation: boolean) => retrieveMuscleEvidence(
      corpusData, { ...report, functionalLimitation }, "Right biceps", "spacecraft",
    ).map((citation) => citation.id);
    expect(sources(false)).toContain("english-sprint-2020");
    expect(sources(false)).not.toContain("tays-sensorimotor-2021");
    expect(sources(true)).toContain("tays-sensorimotor-2021");
  });

  it("uses general evidence when a recognized region has no matching passage", () => {
    const missing = { ...corpusData, chunks: corpusData.chunks.filter((chunk) => chunk.sourceId !== "nasa-shoulder-2025") };
    const results = retrieveMuscleEvidence(missing, report, "Right deltoid", "spacecraft");
    expect(results.length).toBeGreaterThan(0);
    results.forEach((citation) => expect(citation).toHaveProperty("evidenceScope", "general"));
  });

  it("cannot use notes or the environment to supply a missing body-region match", () => {
    expect(retrieveMuscleEvidence(corpus, { ...report, notes: "shoulder pain" }, "Right biceps", "spacecraft")).toEqual([]);
    expect(retrieveMuscleEvidence(corpus, report, "", "shoulder")).toEqual([]);
  });
});
