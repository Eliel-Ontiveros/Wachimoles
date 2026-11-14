import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, MESSAGES, translate } from '../src/i18n/messages.ts';

test('every locale defines every key of the default dictionary', () => {
  const keys = Object.keys(MESSAGES.es).sort();
  for (const l of LOCALES) assert.deepEqual(Object.keys(MESSAGES[l]).sort(), keys, l);
});

test('translate interpolates params', () => {
  assert.equal(translate('es', 'action.opening', { label: 'Misiones' }), 'Abriendo Misiones');
  assert.equal(translate('en', 'action.alerts', { count: 2 }).startsWith('You have 2'), true);
});

test('S6 capabilities mirror: every screen has a summary and 3 examples in every locale', async () => {
  const { SCREENS, describeScreen } = await import('../src/voice/capabilities.ts');
  for (const l of LOCALES) {
    for (const s of SCREENS) {
      const d = describeScreen(s, (k, p) => translate(l, k, p));
      assert.ok(d.summary.length > 10, `${l} ${s}`);
      assert.equal(d.examples.length, 3, `${l} ${s}`);
    }
  }
});
