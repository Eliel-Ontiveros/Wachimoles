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
  // Register another region only after reviewing indexed evidence for that region.
  return [];
}

export function retrieveMuscleEvidence(
  corpus: RagCorpus, report: MuscleReportDto, bodyZone: string, environment: string,
): RagCitation[] {
  const region = regionTerms(bodyZone);
  if (!region.length) return [];
  const query = [
    ...region, report.conditionName,
    report.painIntensity > 0 ? "pain" : "",
    report.swelling ? "swelling" : "",
    report.functionalLimitation ? "limited movement" : "",
  ].join(" ");
  // Negative flags, timestamps and boilerplate never become search terms. Notes
  // are a bounded, low-weight tie-breaker and cannot bypass the region gate.
  return retrieve(corpus, query, `${environment} ${report.notes.slice(0, 200)}`, 4, region);
}
