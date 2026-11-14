import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, MESSAGES, AREAS, translate, STT_LANG, isVoiceLanguage, DEFAULT_VOICE_LANGUAGE } from '../src/i18n/messages.ts';

test('S4 English is the only UI dictionary', () => {
  assert.deepEqual([...LOCALES], ['en']);
  assert.deepEqual(Object.keys(MESSAGES), ['en']);
});

test('translate interpolates params', () => {
  assert.equal(translate('en', 'action.opening', { label: 'Missions' }), 'Opening Missions');
  assert.equal(translate('en', 'action.alerts', { count: 2 }).startsWith('You have 2'), true);
});

test('voice input language setting: en default, es allowed, STT tags', () => {
  assert.equal(DEFAULT_VOICE_LANGUAGE, 'en');
  assert.equal(isVoiceLanguage('es'), true);
  assert.equal(isVoiceLanguage('fr'), false);
  assert.deepEqual(STT_LANG, { en: 'en-US', es: 'es-ES' });
});

test('S6 capabilities mirror: every screen has a summary and 3 examples', async () => {
  const { SCREENS, describeScreen } = await import('../src/voice/capabilities.ts');
  for (const s of SCREENS) {
    const d = describeScreen(s, (k, p) => translate('en', k, p));
    assert.ok(d.summary.length > 10, s);
    assert.equal(d.examples.length, 3, s);
  }
});

test('areas contribute unique keys (no area overrides another)', () => {
  const seen = new Map();
  for (const [area, dict] of Object.entries(AREAS)) {
    for (const k of Object.keys(dict)) {
      assert.equal(seen.has(k), false, `"${k}" defined in ${seen.get(k)} and ${area}`);
      seen.set(k, area);
    }
  }
});

test('S2 dictionary values contain no Spanish accents or inverted punctuation (except the language option name)', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'settings.lang.es') continue;
    assert.equal(/[áéíóúñ¿¡]/i.test(v), false, `${k}: ${v}`);
  }
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test('every t(\'key\') / translate(..., \'key\') literal used in src resolves in the dictionary', () => {
  const keys = new Set(Object.keys(MESSAGES.en));
  const missing = [];
  const re = /\bt\(\s*'([a-zA-Z0-9_.\/-]+)'/g;
  const re2 = /\btranslate\(\s*[\w.]+\s*,\s*'([a-zA-Z0-9_.\/-]+)'/g;
  for (const file of walk(new URL('../src', import.meta.url).pathname)) {
    if (file.includes('/i18n/locales/')) continue;
    const src = readFileSync(file, 'utf8');
    for (const r of [re, re2]) {
      for (const m of src.matchAll(r)) if (!keys.has(m[1])) missing.push(`${file.split('/src/')[1]}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('S3 examples list starts with English examples', () => {
  const ex = MESSAGES.en.examples.split('|');
  assert.ok(ex.length >= 5);
  assert.match(ex[0], /^Open vital signs/);
});
