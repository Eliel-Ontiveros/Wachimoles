import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/voice/parser.ts';

const intent = (s) => {
  const r = parseCommand(s);
  assert.equal(r.ok, true, `"${s}" should parse: ${JSON.stringify(r)}`);
  return r.intent;
};

test('navigation (es/en)', () => {
  assert.equal(intent('Abre signos vitales').route, '/');
  assert.equal(intent('open vital signs').route, '/');
  assert.equal(intent('llévame a misiones').route, '/missions');
  assert.equal(intent('ve a la vista corporal').route, '/explore');
});

test('daily check-in', () => {
  assert.equal(intent('iniciar chequeo diario').type, 'start-checkin');
  assert.equal(intent('start daily check-in').type, 'start-checkin');
});

test('body zones with side', () => {
  const i = intent('ve al bíceps derecho');
  assert.equal(i.type, 'body-zone');
  assert.equal(i.muscleId, 'biceps_der');
  assert.equal(intent('me duele la espalda izquierda').muscleId, 'dorsal_izq');
  assert.equal(intent('select left calf').muscleId, 'gemelo_izq');
  assert.equal(intent('ir a zona lumbar').muscleId, 'lumbar');
  assert.equal(intent('ir al cuello').muscleId, 'cuello');
});

test('recognizer typo tolerance', () => {
  assert.equal(intent('ve al biceps derecho').muscleId, 'biceps_der');
  assert.equal(intent('ve al pectorales derecho').muscleId, 'pectoral_der');
});

test('sided zone without side asks for clarification', () => {
  const r = parseCommand('ve al bíceps');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'ambiguous');
});

test('alerts, menu, help, stop', () => {
  assert.equal(intent('marcar alertas como leídas').type, 'ack-alerts');
  assert.equal(intent('ver mis alertas').type, 'open-alerts');
  assert.equal(intent('abrir menú').type, 'open-menu');
  assert.equal(intent('ayuda').type, 'help');
  assert.equal(intent('cancelar').type, 'stop');
});

test('unrecognized and empty input recover gracefully', () => {
  assert.deepEqual([parseCommand('blah blah').ok, parseCommand('blah blah').reason], [false, 'unknown']);
  assert.equal(parseCommand('   ').reason, 'empty');
});

test('natural phrasings for vitals', () => {
  for (const s of [
    'Quisiera ver cómo va mi ritmo cardíaco',
    'cómo está mi corazón',
    'muéstrame mi frecuencia cardiaca',
    'quiero ver mi oxígeno',
    'how is my heart rate',
  ]) {
    assert.equal(intent(s).route, '/', s);
  }
});
