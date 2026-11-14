import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/voice/parser.ts';
import { startDialog, answer, needsDialog, extractNumbers } from '../src/voice/dialog.ts';

/** Arranca un diálogo desde una frase y devuelve helpers para responder. */
function dialogFrom(phrase) {
  const r = parseCommand(phrase);
  const target = r.ok ? r.intent : r.pending;
  assert.ok(target, `"${phrase}" should give a target: ${JSON.stringify(r)}`);
  const start = startDialog(target);
  assert.ok(start.state, 'dialog should start');
  let state = start.state;
  let question = start.question;
  return {
    get question() {
      return question;
    },
    say(text) {
      const res = answer(state, text);
      state = res.state;
      if (res.question) question = res.question;
      return res;
    },
  };
}

test('number words and decimals (es/en)', () => {
  assert.deepEqual(extractNumbers('siete'), [7]);
  assert.deepEqual(extractNumbers('seven'), [7]);
  assert.deepEqual(extractNumbers('treinta y seis'), [36]);
  assert.deepEqual(extractNumbers('thirty six'), [36]);
  assert.deepEqual(extractNumbers('ciento veinte'), [120]);
  assert.deepEqual(extractNumbers('one hundred twenty'), [120]);
  assert.deepEqual(extractNumbers('cien'), [100]);
  assert.deepEqual(extractNumbers('36,5'), [36.5]);
  assert.deepEqual(extractNumbers('treinta y seis punto cinco'), [36.5]);
  assert.deepEqual(extractNumbers('thirty six point five'), [36.5]);
  assert.deepEqual(extractNumbers('treinta y seis coma cinco'), [36.5]);
  assert.deepEqual(extractNumbers('120 sobre 80'), [120, 80]);
  assert.deepEqual(extractNumbers('ciento veinte sobre ochenta'), [120, 80]);
  assert.deepEqual(extractNumbers('120/80'), [120, 80]);
});

test('observation dialog from "registrar una molestia en el hombro"', () => {
  const d = dialogFrom('registrar una molestia en el hombro');
  assert.equal(d.question.key, 'dialog.q.side');
  let r = d.say('izquierdo');
  assert.equal(d.question.key, 'dialog.q.pain');
  r = d.say('siete');
  assert.equal(d.question.key, 'dialog.q.swelling');
  r = d.say('sí');
  assert.equal(d.question.key, 'dialog.q.limitation');
  r = d.say('no');
  assert.equal(d.question.key, 'dialog.q.notes');
  r = d.say('me duele al levantar el brazo');
  assert.deepEqual(r.done, {
    type: 'register-observation',
    muscleId: 'deltoides_izq',
    muscleName: 'Deltoides izquierdo',
    painIntensity: 7,
    swelling: true,
    functionalLimitation: false,
    notes: 'me duele al levantar el brazo',
  });
});

test('side words, pain words, yes/no variants, notes skip', () => {
  const d = dialogFrom('registrar una molestia en el hombro');
  d.say('the right one');
  assert.equal(d.question.key, 'dialog.q.pain');
  d.say('insoportable');
  d.say('claro');
  d.say('nada');
  const r = d.say('no');
  assert.equal(r.done.muscleId, 'deltoides_der');
  assert.equal(r.done.painIntensity, 10);
  assert.equal(r.done.swelling, true);
  assert.equal(r.done.functionalLimitation, false);
  assert.equal('notes' in r.done, false);

  const e = dialogFrom('register a pain in the left calf');
  assert.equal(e.question.key, 'dialog.q.pain');
  assert.equal(e.say('moderado').done, undefined);
  e.say('yes');
  e.say('nope');
  assert.equal(e.say('skip').done.painIntensity, 5);
  const f = dialogFrom('registrar una molestia en el cuello');
  assert.equal(f.say('leve').done, undefined);
  assert.equal(f.say('fuerte').done, undefined); // fuerte no es sí/no -> retry
});

test('initial fields are not re-asked', () => {
  const d = dialogFrom('registrar una molestia en el hombro izquierdo dolor 6 hinchado');
  assert.equal(d.question.key, 'dialog.q.limitation');
  d.say('sí');
  const r = d.say('no');
  assert.equal(r.done.painIntensity, 6);
  assert.equal(r.done.swelling, true);
  assert.equal(r.done.functionalLimitation, true);
  assert.equal(needsDialog(parseCommand('registrar una molestia en el hombro izquierdo dolor 6 hinchado limitacion').intent), false);
  assert.equal(needsDialog(parseCommand('registrar una molestia en el cuello').intent), true);
});

test('cancel anywhere', () => {
  const d = dialogFrom('registrar una molestia en el hombro');
  const r = d.say('cancelar');
  assert.equal(r.cancelled, true);
  const e = dialogFrom('log pain in the neck');
  assert.equal(e.say('cancel').cancelled, true);
});

test('retry once with a hint, then fail after 2 bad answers', () => {
  const d = dialogFrom('registrar una molestia en el cuello');
  const r1 = d.say('blablabla');
  assert.equal(r1.retry, true);
  assert.equal(d.question.key, 'dialog.q.pain');
  assert.ok(d.question.hintKey);
  const r2 = d.say('hmm');
  assert.equal(r2.failed, true);
  // una respuesta buena resetea los fallos
  const e = dialogFrom('registrar una molestia en el cuello');
  assert.equal(e.say('eh').retry, true);
  e.say('4');
  assert.equal(e.say('eh').retry, true);
  assert.equal(e.question.hintKey !== undefined, true);
  // out-of-range pain is a bad answer
  const g = dialogFrom('registrar una molestia en el cuello');
  assert.equal(g.say('50').retry, true);
  assert.equal(g.say('3').retry, undefined);
});

test('health questionnaire with skips and BP pair', () => {
  const d = dialogFrom('cuestionario de salud');
  assert.equal(d.question.key, 'dialog.q.glucose');
  d.say('110');
  assert.equal(d.question.key, 'dialog.q.bp');
  assert.equal(d.say('120').retry, true); // un solo número
  d.say('120 sobre 80');
  assert.equal(d.question.key, 'dialog.q.temp');
  d.say('treinta y seis punto cinco');
  assert.equal(d.question.key, 'dialog.q.sleep');
  d.say('omitir');
  assert.equal(d.question.key, 'dialog.q.mood');
  d.say('cansado');
  assert.equal(d.question.key, 'dialog.q.symptoms');
  const r = d.say('mareo y fatiga');
  assert.deepEqual(r.done, {
    type: 'fill-health-check',
    bloodSugarMgDl: 110,
    systolicBp: 120,
    diastolicBp: 80,
    temperatureC: 36.5,
    mood: 3,
    symptoms: ['Mareo 0g', 'Fatiga'],
  });
});

test('health: mood words, ninguno, skip phrases, finish early, initial fields', () => {
  const d = dialogFrom('mi glucosa es 100');
  assert.equal(d.question.key, 'dialog.q.bp');
  d.say('no sé');
  d.say('36,5');
  d.say('seven');
  assert.equal(d.question.key, 'dialog.q.mood');
  d.say('óptimo');
  const r = d.say('ninguno');
  assert.equal(r.done.mood, 5);
  assert.equal(r.done.sleepHours, 7);
  assert.equal(r.done.temperatureC, 36.5);
  assert.deepEqual(r.done.symptoms, ['Ninguno']);
  assert.equal('systolicBp' in r.done, false);

  const moods = { bien: 4, estable: 4, tenso: 2, estresado: 2, mal: 1, crítico: 1, '2': 2 };
  for (const [word, mood] of Object.entries(moods)) {
    const e = dialogFrom('mi glucosa es 100 presión 120 80 temperatura 36.5 dormí 8 horas');
    assert.equal(e.question.key, 'dialog.q.mood');
    e.say(word);
    assert.equal(e.say('ninguno').done.mood, mood, word);
  }

  const f = dialogFrom('cuestionario de salud');
  f.say('100');
  const fin = f.say('listo');
  assert.equal(fin.done.bloodSugarMgDl, 100);
});

test('English health answers', () => {
  const d = dialogFrom('health questionnaire');
  d.say('one hundred ten');
  d.say('120 over 80');
  d.say('thirty six point eight');
  d.say('seven and a half');
  d.say('good');
  const r = d.say('none');
  assert.equal(r.done.bloodSugarMgDl, 110);
  assert.equal(r.done.temperatureC, 36.8);
  assert.equal(r.done.sleepHours, 7.5);
  assert.equal(r.done.mood, 4);
});

test('ambiguous zone without register keeps its action', () => {
  const r = parseCommand('fotos del hombro');
  assert.equal(r.ok, false);
  const d = startDialog(r.pending);
  assert.equal(d.question.key, 'dialog.q.side');
  const res = answer(d.state, 'derecho');
  assert.deepEqual(res.done, { type: 'zone-photos', muscleId: 'deltoides_der', muscleName: 'Deltoides derecho' });
});
