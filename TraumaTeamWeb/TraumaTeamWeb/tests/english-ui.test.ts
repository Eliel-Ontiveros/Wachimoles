import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { displaySymptom, getGravityLabel, getRegionCategoryLabel, isNoSymptom } from '../src/utils/display-labels.ts';
import {
  appendConditionUpdate,
  parseConditionUpdates,
} from '../src/utils/condition-updates.ts';

test('legacy Spanish symptoms are displayed in English; English values pass through', () => {
  assert.equal(displaySymptom('Ninguno'), 'None');
  assert.equal(displaySymptom('Mareo 0g'), 'Zero-G dizziness');
  assert.equal(displaySymptom('Congestión'), 'Congestion');
  assert.equal(displaySymptom('Fatiga'), 'Fatigue');
  assert.equal(displaySymptom('Cefalea'), 'Headache');
  assert.equal(displaySymptom('Headache'), 'Headache');
  assert.equal(displaySymptom('Something else'), 'Something else');
  assert.equal(isNoSymptom('Ninguno'), true);
  assert.equal(isNoSymptom('None'), true);
  assert.equal(isNoSymptom('Fatigue'), false);
});

test('parses both English and legacy Spanish update lines', () => {
  const updates = parseConditionUpdates({
    description:
      'Update 1 [14/11 12:00] (Pain 6/10) - Follow-up [Photo: a.jpg]\n' +
      'Actualización 2 [14/11 13:00] (Dolor 3/10) - Mejor [Foto: b.jpg]\n' +
      'Update 3 [14/11 14:00] (Healed · 0/10) - Gone',
  });
  assert.equal(updates.length, 3);
  assert.equal(updates[0].painIntensity, 6);
  assert.equal(updates[0].photoFileName, 'a.jpg');
  assert.equal(updates[1].painIntensity, 3);
  assert.equal(updates[1].photoFileName, 'b.jpg');
  assert.equal(updates[2].isResolvedEvent, true);
  assert.equal(updates[2].title, 'Update 3');
});

test('new updates are written in English and round-trip', () => {
  const first = appendConditionUpdate({ newText: 'Sore', painIntensity: 5, photoPathOrFileName: 'x/y/p.jpg' });
  assert.match(first.serializedDescription, /^Update 1 \[.*\] \(Pain 5\/10\) - Sore \[Photo: p\.jpg\]$/);
  const second = appendConditionUpdate({
    existingDescription: first.serializedDescription,
    newText: '',
    painIntensity: 0,
    isResolvedEvent: true,
  });
  assert.equal(second.addedUpdate.title, 'Update 2');
  assert.equal(second.addedUpdate.text, 'I no longer feel the symptom.');
  assert.match(second.serializedDescription, /Update 2 .*\(Healed · 0\/10\)/);
  const parsed = parseConditionUpdates({ description: second.serializedDescription });
  assert.equal(parsed[1].isResolvedEvent, true);
});

test('legacy plain-text descriptions become "Update 1"', () => {
  const [item] = parseConditionUpdates({ description: 'Dolor al estirar', fallbackPain: 4 });
  assert.equal(item.title, 'Update 1');
  assert.equal(item.text, 'Dolor al estirar');
});

test('region categories keep their stored value and display in English', () => {
  assert.equal(getRegionCategoryLabel('Tronco anterior'), 'Anterior torso');
  assert.equal(getRegionCategoryLabel('Unknown'), 'Unknown');
  assert.equal(getGravityLabel('0g Microgravedad'), '0g Microgravity');
});

test('muscle display names in the anatomy catalog are English; ids are unchanged', () => {
  const source = readFileSync(new URL('../src/data/anatomy-catalog.ts', import.meta.url), 'utf8');
  const names = [...source.matchAll(/^\s+name: '([^']+)',$/gm)].map((m) => m[1]);
  assert.ok(names.length >= 30);
  for (const name of names) assert.doesNotMatch(name, /[áéíóúñ]/i);
  assert.match(source, /id: 'oblicuo_izq',\s+name: 'Left oblique',\s+category: 'Tronco anterior'/);
});
