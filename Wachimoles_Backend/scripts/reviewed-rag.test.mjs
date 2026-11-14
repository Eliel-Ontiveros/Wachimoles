import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashText, reuseIndexedSource, readReviewedText } from './reviewed-rag.mjs';

test('offline reuse detects modified snapshots and overlapping passages', () => {
  const source = { id: 'original', title: 'Original', publisher: 'NASA', url: 'https://www.nasa.gov/original/' };
  const metadata = { ...source, wordCount: 4, contentHash: hashText('one two three four') };
  const chunks = [
    { sourceId: source.id, wordOffset: 0, text: 'one two three' },
    { sourceId: source.id, wordOffset: 2, text: 'three four' },
  ];
  assert.equal(reuseIndexedSource(source, { sources: [metadata], chunks }).metadata, metadata);
  assert.throws(() => reuseIndexedSource({ ...source, url: 'https://www.nasa.gov/changed/' }, { sources: [metadata], chunks }));
  assert.throws(() => reuseIndexedSource(source, { sources: [metadata], chunks: [chunks[0], { ...chunks[1], text: 'tampered four' }] }));
  assert.throws(() => reuseIndexedSource(source, { sources: [{ ...metadata, contentHash: 'wrong' }], chunks }));
});

test('reviewed summaries cannot escape their approved directory or omit scope', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rag-review-'));
  const root = pathToFileURL(directory + '/');
  const source = { id: 'review', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7434884/', contentKind: 'reviewed_summary',
    reviewedFile: 'knowledge/reviewed/review.txt', evidenceContext: 'ISS', sourceSections: 'Results',
    sourceLicense: 'CC BY 4.0', authors: 'Authors', identifier: 'DOI', reviewedAt: '2026-11-14' };
  try {
    await mkdir(join(directory, 'knowledge/reviewed'), { recursive: true });
    await writeFile(join(directory, 'outside.txt'), 'outside');
    await symlink(join(directory, 'outside.txt'), join(directory, source.reviewedFile));
    await assert.rejects(readReviewedText(source, root), /escapes/);
    await assert.rejects(readReviewedText({ ...source, reviewedFile: '../outside.txt' }, root), /Incomplete/);
    await rm(join(directory, source.reviewedFile));
    await writeFile(join(directory, source.reviewedFile), 'This file lacks its reviewed summary label and limits.');
    await assert.rejects(readReviewedText(source, root), /Invalid reviewed summary/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
