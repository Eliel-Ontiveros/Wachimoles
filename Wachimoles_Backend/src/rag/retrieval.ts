import { RagCitation, RagCorpus } from "./rag.types";

const STOP_WORDS = new Set((
  "a an the of on in at for to and or is are be been with from as it its this that " +
  "how what why when can could do does i my me have has should about during " +
  "que como por para los las el la en un una de del y mi me tengo puedo cual " +
  "space astronaut astronauts health nasa human spaceflight affect affected study studied studies"
).split(/\s+/));

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z]{3,}/g) ?? [])
    .map((word) => word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word)
    .filter((word) => !STOP_WORDS.has(word) && !STOP_WORDS.has(`${word}s`));
}

// BM25 lexical retrieval: no embeddings, API calls, or vector database required.
export function retrieve(corpus: RagCorpus, question: string, context: string, limit = 4): RagCitation[] {
  const terms = [...new Set(tokenize(question))];
  if (!terms.length || !corpus.chunks.length) return [];
  const contextTerms = [...new Set(tokenize(context))];
  const documents = corpus.chunks.map((chunk) => {
    const source = corpus.sources.find((item) => item.id === chunk.sourceId);
    const words = tokenize(`${source?.title ?? ""} ${chunk.text}`);
    const frequencies = new Map<string, number>();
    for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    return { chunk, source, words, frequencies };
  });
  const averageLength = documents.reduce((sum, doc) => sum + doc.words.length, 0) / documents.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const doc of documents) {
    for (const term of doc.frequencies.keys()) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  }
  const scoreTerm = (term: string, doc: typeof documents[number]) => {
    const frequency = doc.frequencies.get(term) ?? 0;
    const count = documentFrequency.get(term) ?? 0;
    const inverseFrequency = Math.log(1 + (documents.length - count + 0.5) / (count + 0.5));
    return inverseFrequency * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * doc.words.length / averageLength));
  };
  const ranked = documents
    // Context can rerank evidence, but cannot make an unrelated question relevant.
    .filter((doc) => doc.source && terms.filter((term) => doc.frequencies.has(term)).length >= Math.min(2, terms.length))
    .map((doc) => ({ ...doc, score: terms.reduce((sum, term) => sum + scoreTerm(term, doc), 0) + 0.2 * contextTerms.reduce((sum, term) => sum + scoreTerm(term, doc), 0) }))
    .sort((a, b) => b.score - a.score);
  const counts = new Map<string, number>();
  const results: RagCitation[] = [];
  for (const doc of ranked) {
    const count = counts.get(doc.chunk.sourceId) ?? 0;
    if (count >= 2) continue;
    counts.set(doc.chunk.sourceId, count + 1);
    results.push({ ...doc.source!, citationId: results.length + 1, chunkId: doc.chunk.id, wordOffset: doc.chunk.wordOffset, excerpt: doc.chunk.text });
    if (results.length === limit) break;
  }
  return results;
}
