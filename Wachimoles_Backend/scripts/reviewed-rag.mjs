import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';

export const hashText = (text) => createHash('sha256').update(text).digest('hex');

// Local summaries never authorize fetching a new host or parsing a PDF.
export async function readReviewedText(source, root) {
  if (source.contentKind !== 'reviewed_summary' ||
      !/^knowledge\/reviewed\/[a-z0-9-]+\.txt$/.test(source.reviewedFile ?? '') ||
      !source.evidenceContext || !source.sourceSections || !source.reviewedAt ||
      !source.sourceLicense || !source.authors || !source.identifier) {
    throw new Error(`Incomplete reviewed source: ${source.id}`);
  }
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid citation URL');
  const directory = await realpath(fileURLToPath(new URL('knowledge/reviewed/', root)));
  const path = await realpath(fileURLToPath(new URL(source.reviewedFile, root)));
  if (!path.startsWith(directory + sep)) throw new Error('Reviewed file escapes its directory');
  const text = (await readFile(path, 'utf8')).replace(/\s+/g, ' ').trim();
  // Keep scope and limitations together in a single current-size passage.
  if (!text.startsWith('Reviewed evidence summary, not the complete publication.') ||
      text.split(/\s+/).length > 350 || !text.includes('Findings and applicability limits:')) {
    throw new Error(`Invalid reviewed summary: ${source.id}`);
  }
  return text;
}

export function reuseIndexedSource(source, corpus) {
  const previous = corpus.sources.find((item) => item.id === source.id);
  if (!previous || !['id', 'title', 'publisher', 'url'].every((key) => previous[key] === source[key])) {
    throw new Error(`No matching offline snapshot for ${source.id}; run online ingestion.`);
  }
  const chunks = corpus.chunks.filter((item) => item.sourceId === source.id).sort((a, b) => a.wordOffset - b.wordOffset);
  const words = [];
  for (const chunk of chunks) {
    if (!Number.isInteger(chunk.wordOffset) || chunk.wordOffset < 0 || chunk.wordOffset > words.length) {
      throw new Error(`Invalid cached offsets: ${source.id}`);
    }
    chunk.text.split(/\s+/).forEach((word, i) => {
      const offset = chunk.wordOffset + i;
      if (words[offset] !== undefined && words[offset] !== word) throw new Error(`Cached overlap mismatch: ${source.id}`);
      words[offset] = word;
    });
  }
  if (words.length !== previous.wordCount || hashText(words.join(' ')) !== previous.contentHash) {
    throw new Error(`Cached content hash mismatch: ${source.id}`);
  }
  return { metadata: previous, chunks };
}
