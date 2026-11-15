import type { MuscleReportDto } from "./rag.dto";
import type { RagCitation, RagCorpus } from "./rag.types";
import { retrieve, tokenize } from "./retrieval";

function regionTerms(bodyZone: string): string[] {
  const zone = bodyZone.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(left|right|derecho|derecha|izquierdo|izquierda)\b/g, " ").replace(/\s+/g, " ").trim();
  // Whole-zone aliases reviewed against the current corpus, not arbitrary word
  // overlaps: "Back of leg" is not lumbar and "upper arm" is not shoulder.
  if (["deltoid", "deltoids", "deltoide", "deltoides", "shoulder", "shoulders", "hombro", "hombros"].includes(zone)) {
    return tokenize("shoulder deltoid");
  }
  if (["lower back", "lower-back", "lumbar", "lumbar spine", "paraspinal", "multifidus", "espalda baja"].includes(zone)) {
    return tokenize("lumbar paraspinal multifidus");
  }
  // Unknown regions use general context, never another region's findings.
  return [];
}

export function retrieveMuscleEvidence(
  corpus: RagCorpus, report: MuscleReportDto, bodyZone: string, environment: string,
): RagCitation[] {
  const region = regionTerms(bodyZone);
  const query = [
    ...region, report.conditionName,
    report.painIntensity > 0 ? "pain" : "",
    report.swelling ? "swelling" : "",
    report.functionalLimitation ? "limited movement" : "",
  ].join(" ");
  // Negative flags, timestamps and boilerplate never become search terms.
  const context = `${environment} ${report.notes.slice(0, 200)}`;
  const specific = region.length ? retrieve(corpus, query, context, 4, region) : [];
  if (specific.length) return specific.map((citation) => ({ ...citation, evidenceScope: "region_specific" }));

  // These reviewed sources discuss general muscle function, exercise and movement,
  // not the cause of symptoms in an unstudied muscle. Keep region-specific papers out.
  const generalSources = new Set(["english-sprint-2020"]);
  if (report.functionalLimitation) generalSources.add("tays-sensorimotor-2021");
  const generalCorpus = {
    ...corpus,
    sources: corpus.sources.filter((source) => generalSources.has(source.id)),
    chunks: corpus.chunks.filter((chunk) => generalSources.has(chunk.sourceId)),
  };
  return retrieve(generalCorpus, `muscle strength exercise ${query}`, context)
    .map((citation) => ({ ...citation, evidenceScope: "general" }));
}
