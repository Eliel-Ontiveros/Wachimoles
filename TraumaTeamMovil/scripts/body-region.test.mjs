import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBodyRegion, toBackendBodyRegion } from '../src/utils/body-region.ts';

test('toBackendBodyRegion maps English UI regions to canonical Spanish backend values', () => {
  assert.equal(toBackendBodyRegion('Head and neck'), 'Cabeza y cuello');
  assert.equal(toBackendBodyRegion('Front torso'), 'Tronco anterior');
  assert.equal(toBackendBodyRegion('Anterior torso'), 'Tronco anterior');
  assert.equal(toBackendBodyRegion('Back torso'), 'Tronco posterior');
  assert.equal(toBackendBodyRegion('Posterior torso'), 'Tronco posterior');
  assert.equal(toBackendBodyRegion('Upper limb'), 'Extremidad superior');
  assert.equal(toBackendBodyRegion('Hip and pelvis'), 'Cadera y pelvis');
  assert.equal(toBackendBodyRegion('Lower limb'), 'Extremidad inferior');
});

test('toBackendBodyRegion preserves Spanish backend values regardless of casing/whitespace', () => {
  assert.equal(toBackendBodyRegion('  cabeza y cuello '), 'Cabeza y cuello');
  assert.equal(toBackendBodyRegion('Tronco anterior'), 'Tronco anterior');
  assert.equal(toBackendBodyRegion('Extremidad inferior'), 'Extremidad inferior');
});

test('normalizeBodyRegion maps backend Spanish categories back to English UI categories', () => {
  assert.equal(normalizeBodyRegion('Cabeza y cuello'), 'Head and neck');
  assert.equal(normalizeBodyRegion('Tronco anterior'), 'Front torso');
  assert.equal(normalizeBodyRegion('Tronco posterior'), 'Back torso');
  assert.equal(normalizeBodyRegion('Extremidad superior'), 'Upper limb');
  assert.equal(normalizeBodyRegion('Cadera y pelvis'), 'Hip and pelvis');
  assert.equal(normalizeBodyRegion('Extremidad inferior'), 'Lower limb');
});
