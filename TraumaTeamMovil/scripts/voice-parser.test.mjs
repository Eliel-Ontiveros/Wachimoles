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
  assert.equal(intent('registrar mi chequeo diario').type, 'start-checkin');
  assert.equal(intent('hacer check-in').type, 'start-checkin');
  assert.equal(intent('check in').type, 'start-checkin');
  assert.equal(intent('cuestionario de salud').type, 'fill-health-check');
  assert.equal(intent('llenar cuestionario').type, 'fill-health-check');
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

test('S1: register an observation by voice', () => {
  const i = intent('Quiero registrar una molestia en el hombro izquierdo');
  assert.equal(i.type, 'register-observation');
  assert.equal(i.muscleId, 'deltoides_izq');
  assert.notEqual(parseCommand('anotar dolor en la rodilla derecha').intent?.type, 'register-observation');
  const k = intent('registrar una lesión en el bíceps derecho dolor 6 hinchado');
  assert.deepEqual([k.type, k.muscleId, k.painIntensity, k.swelling], ['register-observation', 'biceps_der', 6, true]);
  assert.equal(intent('register a strong pain in the left calf').painIntensity, 8);
  assert.equal(intent('registrar molestia leve en el cuello').painIntensity, 3);
  const amb = parseCommand('registrar una molestia en el hombro');
  assert.equal(amb.reason, 'ambiguous');
  assert.deepEqual(amb.pending, { type: 'register-observation', muscleId: 'deltoides', muscleName: 'Deltoides' });
});

test('zone detail and photos', () => {
  assert.deepEqual(
    [intent('detalles del bíceps derecho').type, intent('detalles del bíceps derecho').muscleId],
    ['zone-detail', 'biceps_der']
  );
  assert.equal(intent('fotos del cuello').type, 'zone-photos');
  assert.equal(intent('fotos del cuello').muscleId, 'cuello');
});

test('environment, mission setup, arrive early', () => {
  assert.equal(intent('cambia el entorno a marte').environment, 'marte');
  assert.equal(intent('cambia el entorno a la estación').environment, 'nave');
  assert.equal(intent('change environment to moon').environment, 'luna');
  assert.equal(intent('cambia el entorno a la tierra').environment, 'tierra');
  assert.equal(intent('configurar misión').type, 'open-mission-setup');
  assert.equal(intent('llegamos antes').type, 'arrive-early');
  assert.equal(intent('llegada anticipada').type, 'arrive-early');
});

test('complete mission', () => {
  assert.equal(intent('completa la misión de cardio').missionId, 'env-tierra-cardio');
  assert.equal(intent('completa la misión de respiración').missionId, 'env-marte-resp');
  assert.equal(intent('completa la misión de equilibrio').missionId, 'env-luna-balance');
  assert.equal(intent('completa la misión de estiramiento').missionId, 'env-nave-stretch');
  assert.equal(intent('completa la misión de carga').missionId, 'env-marte-load');
  assert.equal(intent('complete the core mission').missionId, 'env-tierra-core');
  assert.equal(intent('completa la misión del chequeo').missionId, 'daily-checkin');
});

test('vital history', () => {
  assert.equal(intent('historial de pulso').metric, 'heart_rate');
  assert.equal(intent('historial de oxígeno').metric, 'spo2');
  assert.equal(intent('historial de estrés').metric, 'stress');
  assert.equal(intent('historial de sueño').metric, 'sleep');
  assert.equal(intent('historial de pulso').type, 'vital-history');
});

test('fill health check', () => {
  assert.deepEqual(
    [intent('mi glucosa es 110').type, intent('mi glucosa es 110').bloodSugarMgDl],
    ['fill-health-check', 110]
  );
  const bp = intent('presión 120 80');
  assert.deepEqual([bp.systolicBp, bp.diastolicBp], [120, 80]);
  assert.equal(intent('temperatura 36.5').temperatureC, 36.5);
  assert.equal(intent('dormí 7 horas').sleepHours, 7);
  assert.equal(intent('me siento cansado').mood, 3);
  const sym = intent('tengo mareo y fatiga');
  assert.deepEqual(sym.symptoms, ['Mareo 0g', 'Fatiga']);
  assert.equal(intent('como me siento').type, 'fill-health-check');
});

test('dismiss alert vs open alerts', () => {
  assert.equal(intent('cerrar alerta').type, 'dismiss-alert');
  assert.equal(intent('ver mis alertas').type, 'open-alerts');
});
