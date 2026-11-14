export interface RagSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  resolvedUrl: string;
  retrievedAt: string;
  contentHash: string;
  wordCount: number;
  // JSON imports widen string literals; the ingestion script validates this value.
  contentKind?: string;
  authors?: string;
  year?: number;
  identifier?: string;
  evidenceContext?: string;
  sourceSections?: string;
  sourceLicense?: string;
  reviewedAt?: string;
  reviewStatus?: string;
}

export interface RagChunk {
  id: string;
  sourceId: string;
  wordOffset: number;
  text: string;
}

export interface RagCorpus {
  version: number;
  sources: RagSource[];
  chunks: RagChunk[];
}

export interface RagCitation extends RagSource {
  citationId: number;
  chunkId: string;
  wordOffset: number;
  excerpt: string;
}

export interface RagAnswer {
  mode: "generated" | "evidence_only" | "insufficient_evidence" | "generation_unavailable";
  answer: string;
  citations: RagCitation[];
  notice: string;
}
