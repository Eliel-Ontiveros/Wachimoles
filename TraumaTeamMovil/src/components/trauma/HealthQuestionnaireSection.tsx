import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  Activity,
  Check,
  Clock,
  Droplets,
  HelpCircle,
  Moon,
  Smile,
  Stethoscope,
  Thermometer,
} from 'lucide-react-native';
import { getTodayIsoDate } from '../../services/mission-api';
import { DailyHealthCheck, HealthStatusLevel } from '../../types/mission';
import { useMission } from './mission-context';
import { DictationButton } from '@/voice/VoiceButton';

const HERO_STARS = [
  { x: 0.08, y: 0.2, r: 1.1, o: 0.65 },
  { x: 0.24, y: 0.14, r: 0.9, o: 0.5 },
  { x: 0.45, y: 0.22, r: 1.2, o: 0.7 },
  { x: 0.68, y: 0.12, r: 1.0, o: 0.6 },
  { x: 0.85, y: 0.28, r: 1.3, o: 0.8 },
  { x: 0.92, y: 0.72, r: 1.0, o: 0.5 },
  { x: 0.18, y: 0.78, r: 0.9, o: 0.45 },
];

const STATUS_STYLE: Record<
  HealthStatusLevel,
  { label: string; color: string; bg: string; border: string }
> = {
  normal: { label: 'Óptimo', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  warning: { label: 'Vigilar', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  critical: { label: 'Atención', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

const MOOD_OPTIONS: {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  tag: string;
  status: HealthStatusLevel;
}[] = [
  { value: 5, label: 'Óptimo', tag: '5/5', status: 'normal' },
  { value: 4, label: 'Estable', tag: '4/5', status: 'normal' },
  { value: 3, label: 'Cansado', tag: '3/5', status: 'warning' },
  { value: 2, label: 'Tenso', tag: '2/5', status: 'warning' },
  { value: 1, label: 'Crítico', tag: '1/5', status: 'critical' },
];

const SYMPTOM_CHIPS = ['Ninguno', 'Mareo 0g', 'Congestión', 'Fatiga', 'Cefalea'];

function parseNum(raw: string): number | null {
  const clean = raw.replace(',', '.').trim();
  if (!clean) return null;
  const val = Number(clean);
  return isNaN(val) ? null : val;
}

function evalBloodSugar(v: number | null): HealthStatusLevel | null {
  if (v === null) return null;
  if (v < 55 || v > 180) return 'critical';
  if (v < 70 || v > 139) return 'warning';
  return 'normal';
}

function evalBloodPressure(sys: number | null, dia: number | null): HealthStatusLevel | null {
  if (sys === null && dia === null) return null;
  if ((sys !== null && (sys >= 140 || sys < 80)) || (dia !== null && dia >= 90)) {
    return 'critical';
  }
  if ((sys !== null && (sys > 120 || sys < 90)) || (dia !== null && (dia > 80 || dia < 60))) {
    return 'warning';
  }
  return 'normal';
}

function evalTemperature(t: number | null): HealthStatusLevel | null {
  if (t === null) return null;
  if (t >= 38.1 || t < 35.2) return 'critical';
  if (t >= 37.5 || t < 36.0) return 'warning';
  return 'normal';
}

function evalSleep(h: number | null): HealthStatusLevel | null {
  if (h === null) return null;
  if (h < 5.5) return 'critical';
  if (h < 7) return 'warning';
  return 'normal';
}

function StatusPill({ status }: { status: HealthStatusLevel | null }) {
  if (!status) return null;
  const cfg = STATUS_STYLE[status];
  return (
    <View
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: 1 }}
      className="flex-row items-center rounded-lg px-2 py-0.5">
      <View
        style={{ backgroundColor: cfg.color }}
        className="mr-1 h-1.5 w-1.5 rounded-full"
      />
      <Text style={{ color: cfg.color }} className="font-mono text-[9px] font-bold">
        {cfg.label}
      </Text>
    </View>
  );
}

// Barra visual de rango codificada por color (normal / vigilar / crítico)
function MetricRangeBar({
  value,
  min,
  max,
  status,
}: {
  value: number | null;
  min: number;
  max: number;
  status: HealthStatusLevel | null;
}) {
  const pct =
    value === null
      ? 0
      : Math.max(4, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
  const fill = status ? STATUS_STYLE[status].color : '#cbd5e1';

  return (
    <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: fill,
          borderRadius: 999,
        }}
      />
    </View>
  );
}

// Cuestionario médico diario editable durante el día, con diseño visual acorde a la app
export function HealthQuestionnaireSection() {
  const { vitals, healthChecks, submitHealthCheck } = useMission();
  const todayIso = getTodayIsoDate();

  const todayCheck = useMemo(
    () => healthChecks.find((c) => c.dateIso === todayIso),
    [healthChecks, todayIso]
  );

  const [glucoseText, setGlucoseText] = useState(
    todayCheck?.bloodSugarMgDl != null ? String(todayCheck.bloodSugarMgDl) : ''
  );
  const [sysText, setSysText] = useState(
    todayCheck?.systolicBp != null ? String(todayCheck.systolicBp) : ''
  );
  const [diaText, setDiaText] = useState(
    todayCheck?.diastolicBp != null ? String(todayCheck.diastolicBp) : ''
  );
  const [tempText, setTempText] = useState(
    todayCheck?.temperatureC != null ? String(todayCheck.temperatureC) : ''
  );
  const [sleepText, setSleepText] = useState(
    todayCheck?.sleepHours != null ? String(todayCheck.sleepHours) : ''
  );
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(todayCheck?.mood ?? 4);
  const [symptoms, setSymptoms] = useState<string[]>(todayCheck?.symptoms ?? ['Ninguno']);
  const [notes, setNotes] = useState(todayCheck?.notes ?? '');
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  // Sincroniza el formulario con el registro de hoy si ya fue guardado o actualizado
  useEffect(() => {
    if (!todayCheck) return;
    setGlucoseText(todayCheck.bloodSugarMgDl != null ? String(todayCheck.bloodSugarMgDl) : '');
    setSysText(todayCheck.systolicBp != null ? String(todayCheck.systolicBp) : '');
    setDiaText(todayCheck.diastolicBp != null ? String(todayCheck.diastolicBp) : '');
    setTempText(todayCheck.temperatureC != null ? String(todayCheck.temperatureC) : '');
    setSleepText(todayCheck.sleepHours != null ? String(todayCheck.sleepHours) : '');
    setMood(todayCheck.mood);
    setSymptoms(todayCheck.symptoms.length > 0 ? todayCheck.symptoms : ['Ninguno']);
    setNotes(todayCheck.notes ?? '');
  }, [todayCheck]);

  const glucose = parseNum(glucoseText);
  const sys = parseNum(sysText);
  const dia = parseNum(diaText);
  const temp = parseNum(tempText);
  const sleep = parseNum(sleepText);

  const evaluation = useMemo(() => {
    const sGlucose = evalBloodSugar(glucose);
    const sBp = evalBloodPressure(sys, dia);
    const sTemp = evalTemperature(temp);
    const sSleep = evalSleep(sleep);
    const sMood = MOOD_OPTIONS.find((m) => m.value === mood)?.status ?? 'normal';

    const levels = [sGlucose, sBp, sTemp, sSleep, sMood].filter(
      (x): x is HealthStatusLevel => x !== null
    );

    let overall: HealthStatusLevel = 'normal';
    if (levels.includes('critical')) overall = 'critical';
    else if (levels.includes('warning')) overall = 'warning';

    const actions: string[] = [];
    if (sGlucose === 'critical') {
      actions.push('Glucosa fuera de rango seguro: ajustar ingesta y notificar a control en tierra.');
    } else if (sGlucose === 'warning') {
      actions.push('Glucosa alterada: repetir prueba capilar en 30 min.');
    }

    if (sBp === 'critical') {
      actions.push('Presión arterial crítica: reposar 10 min y contactar médico de vuelo.');
    } else if (sBp === 'warning') {
      actions.push('Presión fuera de rango óptimo: vigilar hidratación.');
    }

    if (sTemp === 'critical') {
      actions.push('Temperatura anormal: revisar posible infección o enfriamiento del traje.');
    } else if (sTemp === 'warning') {
      actions.push('Temperatura límite: reevaluar en 1 hora.');
    }

    if (sSleep === 'critical' || sSleep === 'warning') {
      actions.push('Déficit de sueño: priorizar bloque de descanso y luz tenue en cabina.');
    }
    if (sMood === 'critical' || sMood === 'warning') {
      actions.push('Carga emocional: realizar pausa activa o sesión con soporte en tierra.');
    }

    const recommendation =
      actions.length > 0
        ? actions[0]
        : 'Indicadores dentro de parámetros esperados. Mantén hidratación y rutina diaria.';

    const completedCount =
      (glucose !== null ? 1 : 0) +
      (sys !== null || dia !== null ? 1 : 0) +
      (temp !== null ? 1 : 0) +
      (sleep !== null ? 1 : 0) +
      1; // ánimo siempre tiene valor seleccionado

    return { sGlucose, sBp, sTemp, sSleep, sMood, overall, recommendation, completedCount };
  }, [glucose, sys, dia, temp, sleep, mood]);

  const toggleSymptom = (sym: string) => {
    if (sym === 'Ninguno') {
      setSymptoms(['Ninguno']);
      return;
    }
    setSymptoms((prev) => {
      const cleaned = prev.filter((s) => s !== 'Ninguno');
      if (cleaned.includes(sym)) {
        const next = cleaned.filter((s) => s !== sym);
        return next.length === 0 ? ['Ninguno'] : next;
      }
      return [...cleaned, sym];
    });
  };

  const handleSave = () => {
    submitHealthCheck({
      bloodSugarMgDl: glucose,
      systolicBp: sys,
      diastolicBp: dia,
      temperatureC: temp,
      sleepHours: sleep,
      mood,
      symptoms,
      notes: notes.trim(),
      overallStatus: evaluation.overall,
      recommendation: evaluation.recommendation,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2600);
  };

  const overallCfg = STATUS_STYLE[evaluation.overall];
  const completionPct = Math.round((evaluation.completedCount / 5) * 100);

  const renderHelp = (key: string, text: string) =>
    openHelp === key ? (
      <View className="mt-2.5 rounded-xl border border-slate-200 bg-[#f7f7f7] p-2.5">
        <Text className="font-mono text-[10px] leading-4 text-slate-600">{text}</Text>
      </View>
    ) : null;

  const summaryItems: { label: string; status: HealthStatusLevel | null }[] = [
    { label: 'Glucosa', status: evaluation.sGlucose },
    { label: 'PA', status: evaluation.sBp },
    { label: 'Temp', status: evaluation.sTemp },
    { label: 'Sueño', status: evaluation.sSleep },
    { label: 'Ánimo', status: evaluation.sMood },
  ];

  return (
    <View className="pb-4">
      {/* Tarjeta Hero Espacial del Cuestionario Diario */}
      <View
        style={{ backgroundColor: '#060b19', borderColor: 'rgba(56, 189, 248, 0.25)' }}
        className="mb-3.5 overflow-hidden rounded-2xl border p-4 shadow-md">
        <Svg
          viewBox="0 0 320 120"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
          pointerEvents="none">
          <Circle cx={280} cy={26} r={44} fill="#0ea5e9" opacity={0.1} />
          {HERO_STARS.map((st, idx) => (
            <Circle
              key={idx}
              cx={st.x * 320}
              cy={st.y * 120}
              r={st.r}
              fill="#e0f2fe"
              opacity={st.o}
            />
          ))}
        </Svg>

        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center pr-2">
            <View
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.16)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                borderWidth: 1,
              }}
              className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl">
              <Stethoscope size={17} color="#38bdf8" />
            </View>
            <View className="flex-1">
              <Text className="font-mono text-xs font-extrabold text-white">
                Cuestionario Médico Diario
              </Text>
              <View className="mt-0.5 flex-row items-center">
                <Clock size={10} color="#94a3b8" />
                <Text className="ml-1 font-mono text-[9.5px] text-slate-300">
                  {todayCheck ? `Actualizado ${todayCheck.recordedAt}` : 'Pendiente hoy · Editable todo el día'}
                </Text>
              </View>
            </View>
          </View>
          <StatusPill status={evaluation.overall} />
        </View>

        {/* Barra de progreso del chequeo de hoy */}
        <View className="mt-3">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-mono text-[9.5px] text-sky-300">
              {evaluation.completedCount}/5 indicadores evaluados hoy
            </Text>
            <Text className="font-mono text-[9.5px] font-bold text-slate-300">
              {completionPct}%
            </Text>
          </View>
          <View
            style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)' }}
            className="h-1.5 overflow-hidden rounded-full">
            <View
              style={{ width: `${completionPct}%`, backgroundColor: '#38bdf8' }}
              className="h-full rounded-full"
            />
          </View>
        </View>

        {/* Resumen visual de 5 indicadores */}
        <View className="mt-3 flex-row gap-1.5">
          {summaryItems.map((it) => {
            const dotColor = it.status ? STATUS_STYLE[it.status].color : '#475569';
            return (
              <View
                key={it.label}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  borderWidth: 1,
                }}
                className="flex-1 flex-row items-center justify-center rounded-lg py-1">
                <View
                  style={{ backgroundColor: dotColor }}
                  className="mr-1 h-1.5 w-1.5 rounded-full"
                />
                <Text className="font-mono text-[8.5px] font-bold text-slate-200" numberOfLines={1}>
                  {it.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 1. Azúcar en sangre */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
              <Droplets size={15} color="#0284c7" />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800">
                Azúcar en sangre
              </Text>
              <Text className="font-mono text-[9px] text-slate-400">Meta: 70–139 mg/dL</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <StatusPill status={evaluation.sGlucose} />
            <Pressable onPress={() => setOpenHelp(openHelp === 'glucose' ? null : 'glucose')}>
              <HelpCircle size={15} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <View className="mt-2.5 flex-row items-center rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
          <TextInput
            value={glucoseText}
            onChangeText={setGlucoseText}
            keyboardType="numeric"
            placeholder="Ej. 95"
            placeholderTextColor="#94a3b8"
            className="flex-1 font-mono text-xs font-bold text-slate-800"
          />
          <Text className="font-mono text-[10px] font-bold text-slate-400">mg/dL</Text>
        </View>

        <View className="mt-2 flex-row gap-1.5">
          {['85', '95', '110', '145'].map((val) => {
            const active = glucoseText.trim() === val;
            return (
              <Pressable
                key={val}
                onPress={() => setGlucoseText(val)}
                className={`flex-1 items-center rounded-lg border py-1 ${
                  active
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[9.5px] font-bold text-slate-700">{val}</Text>
              </Pressable>
            );
          })}
        </View>
        <MetricRangeBar value={glucose} min={40} max={200} status={evaluation.sGlucose} />
        {renderHelp(
          'glucose',
          'Mide con glucómetro capilar. En ayunas lo normal es 70–99 mg/dL. Valores extremos indican riesgo nutricional o metabólico.'
        )}
      </View>

      {/* 2. Presión arterial */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-rose-50">
              <Activity size={15} color="#ef4444" />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800">
                Presión arterial
              </Text>
              <Text className="font-mono text-[9px] text-slate-400">Meta: 90-120 / 60-80 mmHg</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5">
            <StatusPill status={evaluation.sBp} />
            <Pressable onPress={() => setOpenHelp(openHelp === 'bp' ? null : 'bp')}>
              <HelpCircle size={15} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        <View className="mt-2.5 flex-row gap-2">
          <View className="flex-1 flex-row items-center rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
            <TextInput
              value={sysText}
              onChangeText={setSysText}
              keyboardType="numeric"
              placeholder="Sis (120)"
              placeholderTextColor="#94a3b8"
              className="flex-1 font-mono text-xs font-bold text-slate-800"
            />
            <Text className="font-mono text-[9.5px] text-slate-400">mmHg</Text>
          </View>
          <View className="flex-1 flex-row items-center rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
            <TextInput
              value={diaText}
              onChangeText={setDiaText}
              keyboardType="numeric"
              placeholder="Dia (80)"
              placeholderTextColor="#94a3b8"
              className="flex-1 font-mono text-xs font-bold text-slate-800"
            />
            <Text className="font-mono text-[9.5px] text-slate-400">mmHg</Text>
          </View>
        </View>

        <View className="mt-2 flex-row gap-1.5">
          {[
            { s: '115', d: '75' },
            { s: '120', d: '80' },
            { s: '132', d: '84' },
          ].map((preset) => {
            const active = sysText.trim() === preset.s && diaText.trim() === preset.d;
            return (
              <Pressable
                key={`${preset.s}-${preset.d}`}
                onPress={() => {
                  setSysText(preset.s);
                  setDiaText(preset.d);
                }}
                className={`flex-1 items-center rounded-lg border py-1 ${
                  active
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[9.5px] font-bold text-slate-700">
                  {preset.s}/{preset.d}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <MetricRangeBar value={sys} min={70} max={160} status={evaluation.sBp} />
        {renderHelp(
          'bp',
          'Mide en reposo a la altura del corazón. En 0g los fluidos migran al torso; vigila cifras >=140/90 o <90/60 mmHg.'
        )}
      </View>

      {/* 3. Temperatura y Sueño */}
      <View className="mb-2.5 flex-row gap-2.5">
        <View className="flex-1 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                <Thermometer size={14} color="#d97706" />
              </View>
              <Text className="font-mono text-[11px] font-bold text-slate-800">Temp.</Text>
            </View>
            <Pressable onPress={() => setOpenHelp(openHelp === 'temp' ? null : 'temp')}>
              <HelpCircle size={14} color="#94a3b8" />
            </Pressable>
          </View>
          <View className="mt-2 flex-row items-center rounded-xl border border-slate-200 bg-[#f7f7f7] px-2.5 py-2">
            <TextInput
              value={tempText}
              onChangeText={setTempText}
              keyboardType="decimal-pad"
              placeholder="36.6"
              placeholderTextColor="#94a3b8"
              className="flex-1 font-mono text-xs font-bold text-slate-800"
            />
            <Text className="font-mono text-[10px] text-slate-400">°C</Text>
          </View>
          <View className="mt-1.5 flex-row gap-1">
            {['36.5', '36.8'].map((v) => (
              <Pressable
                key={v}
                onPress={() => setTempText(v)}
                className={`flex-1 items-center rounded-md border py-0.5 ${
                  tempText.trim() === v
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[9px] font-bold text-slate-700">{v}°</Text>
              </Pressable>
            ))}
          </View>
          <MetricRangeBar value={temp} min={34.5} max={39.5} status={evaluation.sTemp} />
          <View className="mt-1.5 items-start">
            <StatusPill status={evaluation.sTemp} />
          </View>
        </View>

        <View className="flex-1 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="mr-2 h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                <Moon size={14} color="#4f46e5" />
              </View>
              <Text className="font-mono text-[11px] font-bold text-slate-800">Sueño</Text>
            </View>
            <Pressable onPress={() => setOpenHelp(openHelp === 'sleep' ? null : 'sleep')}>
              <HelpCircle size={14} color="#94a3b8" />
            </Pressable>
          </View>
          <View className="mt-2 flex-row items-center rounded-xl border border-slate-200 bg-[#f7f7f7] px-2.5 py-2">
            <TextInput
              value={sleepText}
              onChangeText={setSleepText}
              keyboardType="decimal-pad"
              placeholder="7.5"
              placeholderTextColor="#94a3b8"
              className="flex-1 font-mono text-xs font-bold text-slate-800"
            />
            <Text className="font-mono text-[10px] text-slate-400">hrs</Text>
          </View>
          <View className="mt-1.5 flex-row gap-1">
            {['6.5', '7.5', '8'].map((v) => (
              <Pressable
                key={v}
                onPress={() => setSleepText(v)}
                className={`flex-1 items-center rounded-md border py-0.5 ${
                  sleepText.trim() === v
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text className="font-mono text-[9px] font-bold text-slate-700">{v}h</Text>
              </Pressable>
            ))}
          </View>
          <MetricRangeBar value={sleep} min={3} max={10} status={evaluation.sSleep} />
          <View className="mt-1.5 items-start">
            <StatusPill status={evaluation.sSleep} />
          </View>
        </View>
      </View>

      {renderHelp(
        'temp',
        'Temperatura normal: 36.0–37.4 °C. >=38.1 °C puede indicar infección en ambiente cerrado o sobrecalentamiento.'
      )}
      {renderHelp(
        'sleep',
        'Meta recomendada: 7–8.5 hrs diarias. Sin ciclo solar natural, dormir <7 hrs afecta memoria, ánimo e inmunidad.'
      )}

      {/* 4. Estado de ánimo y salud conductual */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <Smile size={15} color="#059669" />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800">Estado de ánimo</Text>
              <Text className="font-mono text-[9px] text-slate-400">Salud conductual diaria</Text>
            </View>
          </View>
          <Pressable onPress={() => setOpenHelp(openHelp === 'mood' ? null : 'mood')}>
            <HelpCircle size={15} color="#94a3b8" />
          </Pressable>
        </View>

        <View className="mt-2.5 flex-row gap-1.5">
          {MOOD_OPTIONS.map((opt) => {
            const active = mood === opt.value;
            const st = STATUS_STYLE[opt.status];
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMood(opt.value)}
                style={
                  active
                    ? { backgroundColor: st.bg, borderColor: st.color, borderWidth: 1.5 }
                    : undefined
                }
                className={`flex-1 items-center rounded-xl py-2 ${
                  active ? '' : 'border border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text
                  style={active ? { color: st.color } : undefined}
                  className={`font-mono text-[9.5px] font-bold ${active ? '' : 'text-slate-600'}`}
                  numberOfLines={1}>
                  {opt.label}
                </Text>
                <Text className="mt-0.5 font-mono text-[8px] text-slate-400">{opt.tag}</Text>
              </Pressable>
            );
          })}
        </View>
        {renderHelp(
          'mood',
          'El aislamiento y confinamiento prolongado elevan el riesgo conductual. Registra tu estado para detectar fatiga a tiempo.'
        )}
      </View>

      {/* 5. Síntomas frecuentes y notas */}
      <View className="mb-3 rounded-2xl border border-trauma-line bg-white p-3.5 shadow-xs">
        <Text className="font-mono text-xs font-bold text-slate-800">Síntomas en misión</Text>
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {SYMPTOM_CHIPS.map((sym) => {
            const active = symptoms.includes(sym);
            return (
              <Pressable
                key={sym}
                onPress={() => toggleSymptom(sym)}
                className={`rounded-xl border px-2.5 py-1.5 ${
                  active
                    ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                    : 'border-slate-200 bg-[#f7f7f7]'
                }`}>
                <Text
                  className={`font-mono text-[10px] font-bold ${
                    active ? 'text-trauma-ink' : 'text-slate-600'
                  }`}>
                  {sym}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {(vitals.heartRate !== null || vitals.spo2 !== null) && (
          <View className="mt-2.5 flex-row gap-2 rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
            <Text className="font-mono text-[10px] text-slate-500">
              Reloj: {vitals.heartRate !== null ? `${vitals.heartRate} Lpm` : '--'}{' '}
              {vitals.spo2 !== null ? `· SpO2 ${vitals.spo2}%` : ''}
            </Text>
          </View>
        )}

        <View className="mt-2.5 rounded-xl border border-slate-200 bg-[#f7f7f7] px-3 py-2">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Nota clínica adicional (opcional)..."
            placeholderTextColor="#94a3b8"
            className="font-mono text-[11px] text-slate-700"
          />
        </View>
        <View className="mt-2">
          <DictationButton
            label="Dictar nota"
            onText={(t) => setNotes((prev) => (prev ? `${prev} ${t}` : t))}
          />
        </View>
      </View>

      {/* Guía automática según semáforo */}
      <View
        style={{
          backgroundColor: overallCfg.bg,
          borderColor: overallCfg.border,
          borderLeftColor: overallCfg.color,
          borderWidth: 1,
          borderLeftWidth: 4,
        }}
        className="mb-3 rounded-2xl p-3.5">
        <Text
          style={{ color: overallCfg.color }}
          className="font-mono text-[10px] font-extrabold uppercase">
          Guía recomendada · {overallCfg.label}
        </Text>
        <Text className="mt-1 font-mono text-[11px] leading-4 text-slate-700">
          {evaluation.recommendation}
        </Text>
      </View>

      {/* Botón guardar / actualizar hoy */}
      <Pressable
        onPress={handleSave}
        className="flex-row items-center justify-center rounded-2xl border border-trauma-cyanEdge bg-trauma-cyanSoft py-3.5 shadow-xs active:opacity-80">
        <Check size={15} color="#0f172a" strokeWidth={2.5} />
        <Text className="ml-1.5 font-mono text-xs font-extrabold text-trauma-ink">
          {savedBanner
            ? 'Cuestionario de hoy actualizado'
            : todayCheck
              ? 'Actualizar cuestionario de hoy'
              : 'Guardar cuestionario de hoy'}
        </Text>
      </Pressable>

      {/* Historial de evaluaciones recientes */}
      {healthChecks.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 font-mono text-xs font-bold text-trauma-ink">
            Historial diario ({healthChecks.length})
          </Text>
          <View className="gap-2">
            {healthChecks.slice(0, 5).map((item: DailyHealthCheck) => {
              const st = STATUS_STYLE[item.overallStatus];
              return (
                <View
                  key={item.id}
                  className="rounded-2xl border border-trauma-line bg-white p-3 shadow-xs">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-mono text-[10px] font-bold text-slate-500">
                      {item.dateIso === todayIso ? `Hoy (${item.recordedAt})` : item.recordedAt}
                    </Text>
                    <View
                      style={{ backgroundColor: st.bg, borderColor: st.border, borderWidth: 1 }}
                      className="rounded-lg px-2 py-0.5">
                      <Text style={{ color: st.color }} className="font-mono text-[9px] font-bold">
                        {st.label}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-1 font-mono text-[11px] font-bold text-slate-800">
                    {item.bloodSugarMgDl !== null ? `Glucosa ${item.bloodSugarMgDl} · ` : ''}
                    {item.systolicBp !== null && item.diastolicBp !== null
                      ? `PA ${item.systolicBp}/${item.diastolicBp} · `
                      : ''}
                    {item.temperatureC !== null ? `${item.temperatureC}°C · ` : ''}
                    {item.sleepHours !== null ? `Sueño ${item.sleepHours}h` : 'Check conductual'}
                  </Text>
                  <Text className="mt-0.5 font-mono text-[10px] text-slate-500">
                    {item.recommendation}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
