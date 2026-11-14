import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const allowedHosts = new Set(['www.nasa.gov', 'www.asc-csa.gc.ca', 'www.csa-asc.gc.ca']);

function verifyUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new Error(`Source URL is outside the curated agency allowlist: ${url.origin}`);
  }
}

// This small extractor targets the five curated HTML pages, not arbitrary websites.
function extractText(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1];
  if (!main) throw new Error('No main element found. Review the source page before indexing.');
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", ndash: '-', mdash: '-', hellip: '...' };
  return main
    .replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (original, code) => {
      if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? original;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    })
    .replace(/\s+/g, ' ').trim()
    .replace(/^Top of page\s+/i, '')
    .replace(/\s+(?:Keep Exploring Discover More Topics From NASA|Explore further Testing Technologies|Follow us Facebook:)[\s\S]*$/i, '');
}

const sources = JSON.parse(await readFile(new URL('knowledge/sources.json', root), 'utf8'));
const indexedSources = [];
const chunks = [];
for (const source of sources) {
  verifyUrl(source.url);
  // Follow redirects explicitly so an unexpected host is never downloaded.
  let url = source.url;
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    verifyUrl(url);
    response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'TraumaTeam-RAG/0.1 (educational hackathon resource indexing)' },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Missing redirect location: ${source.id}`);
      url = new URL(location, url).href;
      continue;
    }
    break;
  }
  if (!response?.ok) throw new Error(`Could not download ${source.id}: HTTP ${response?.status}`);
  if (!response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`Expected HTML for ${source.id}; PDFs require a separate text extraction step.`);
  }
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error(`Unexpectedly large document: ${source.id}`);
  const text = extractText(html);
  const words = text.split(/\s+/);
  if (words.length < 80 || !/space|astronaut|radiation/i.test(text)) {
    throw new Error(`Unexpected content for ${source.id}; refusing to replace the index.`);
  }
  const metadata = {
    ...source,
    resolvedUrl: url,
    retrievedAt: new Date().toISOString(),
    contentHash: createHash('sha256').update(text).digest('hex'),
    wordCount: words.length,
  };
  indexedSources.push(metadata);
  for (let offset = 0; offset < words.length; offset += 280) {
    chunks.push({ id: `${source.id}:${offset}`, sourceId: source.id, wordOffset: offset, text: words.slice(offset, offset + 350).join(' ') });
    if (offset + 350 >= words.length) break;
  }
  console.log(`${source.id}: ${words.length} words`);
}
const output = new URL('src/rag/corpus.json', root);
const temporary = new URL('src/rag/corpus.json.tmp', root);
await writeFile(temporary, JSON.stringify({ version: 1, sources: indexedSources, chunks }, null, 2) + '\n');
await rename(temporary, output);
console.log(`Indexed ${chunks.length} passages from ${indexedSources.length} sources. Rebuild/restart the backend.`);
