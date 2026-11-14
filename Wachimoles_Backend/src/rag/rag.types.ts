export interface RagSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  resolvedUrl: string;
  retrievedAt: string;
  contentHash: string;
  wordCount: number;
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
