import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { Check, Clock, HelpCircle } from 'lucide-react-native';
import { EnvironmentBannerBackdrop } from './EnvironmentSelector';
import { getTodayIsoDate } from '../../services/mission-api';
import { DailyHealthCheck, HealthStatusLevel } from '../../types/mission';
import { useMission } from './mission-context';
import { displaySymptom } from '@/utils/symptoms';
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { useAppTheme, type Palette, type Scheme } from '@/theme';
import { DictationButton } from '@/voice/VoiceButton';
import { useVoice } from '@/voice/voice-context';

function GlucosaIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30.19 34.63">
      <Polygon fill={color} points="30,22.67 24.54,24.44 18.71,22.6 24.18,20.83 30,22.67" />
      <Polygon fill={color} points="23.82,24.89 18.33,23.25 18.33,28.84 23.82,31.86 23.82,24.89" />
      <Polygon fill={color} points="24.71,25.07 24.76,25.07 24.76,32.04 30.19,29.81 30.19,23.5 24.71,25.07" />
      <Path
        fill={color}
        d="M17.78,29.19v-6.69l5.15-2.16c-1.35-4.68-4.71-9.92-8.23-15.4-1.36-2.13-2.59-3.82-3.45-4.94-.74,1.13-1.83,2.84-3.06,4.99C2.31,15.27-1.8,22.46.79,28.13c1.79,3.92,6.46,6.46,10.83,6.5,3.35.03,6.79-1.36,9.1-3.64L17.78,29.19Z"
      />
    </Svg>
  );
}

function FreqIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 31.93 31.81">
      <Polygon
        fill={color}
        points="0,15.45 5.45,14.66 9.43,0 17.27,22.72 21.25,14.77 31.93,16.59 22.38,17.5 18.06,31.81 10.45,12.72 7.95,17.72 0,15.45"
      />
    </Svg>
  );
}

function TermoIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20.58 42.61">
      <Path
        fill={color}
        d="M15.18,31.15c-.47-.97-1.11-1.8-1.86-2.48l7.13-24.15c.52-1.91-.6-3.87-2.5-4.39s-3.87.6-4.39,2.5l-7.14,24.17c-.64.13-1.28.33-1.9.62-3.97,1.92-5.64,6.69-3.73,10.67s6.69,5.64,10.67,3.72C15.43,39.9,17.1,35.12,15.18,31.15ZM7.02,38.15c-2.43-.67-3.87-3.18-3.21-5.62.49-1.77,1.94-3.01,3.64-3.3L13.94,7.02c.28-1.07,1.38-1.7,2.44-1.41h0c1.07.29,1.7,1.38,1.41,2.45l-6.51,22.27c1.25,1.12,1.84,2.88,1.37,4.61C11.98,37.38,9.46,38.82,7.02,38.15Z"
      />
      <Circle fill={color} cx={14.56} cy={11.96} r={1.98} />
    </Svg>
  );
}

function AnimoIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36.95 36.95">
      <Path
        fill={color}
        d="M17.67.02C7.47.46-.43,9.09.02,19.28s9.07,18.1,19.26,17.66c10.2-.45,18.1-9.08,17.65-19.27S27.86-.43,17.67.02ZM21.58,9.52c1.62-.07,2.99,1.19,3.06,2.81.08,1.63-1.18,3-2.8,3.07-1.63.07-3-1.19-3.07-2.81C18.7,10.97,19.96,9.6,21.58,9.52ZM12.1,9.94c1.62-.07,2.99,1.19,3.07,2.81.07,1.62-1.19,2.99-2.81,3.06-1.63.08-3-1.18-3.07-2.8S10.48,10.01,12.1,9.94ZM19.97,31.44c-.47.08-.95.13-1.43.15-2.86.13-5.79-.83-8.22-2.72-3.03-2.36-4.94-5.91-5.23-9.76-.07-.82.55-1.55,1.38-1.61.01,0,.03,0,.05,0,.8-.04,1.5.57,1.56,1.38.23,3.01,1.72,5.78,4.08,7.62,2.17,1.69,4.83,2.41,7.3,1.98,4.57-.79,8.04-5.37,7.89-10.41-.03-.83.63-1.52,1.45-1.55.83-.02,1.52.63,1.55,1.46C30.54,24.59,26.08,30.37,19.97,31.44Z"
      />
    </Svg>
  );
}

function EstresIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40.72 47.19">
      <Path
        fill={color}
        d="M37.69,16.7c.06.08.06.13.04.15-.03.03-.09.07-.13.09l-2.59.92c-1.68.6-3.29,1.24-4.87,2.05l-.91.47,3.29-.86c.37,2.59.26,5.21-.43,7.7-.78,2.86-2.65,5.41-4.75,7.59l1.44,6.8c.03.14-.02.25-.14.3l-6.26,2.13-5.11,1.76-3.87,1.35c-.08.03-.2.06-.26.04-.06-.02-.16-.11-.19-.22l-1.42-7.15-3.42.27-1.66.03c-1.46-.06-2.58-.78-2.66-2.28l-.18-3.46-.16-2.66c-.01-.3-.25-.5-.55-.51l-2.18-.09c-.46-.02-.79-.36-.71-.83s.28-.89.52-1.29l.75-1.25,2.49-3.86c-.13-2.61-.18-4.54,1.02-6.83.7-1.34,1.59-2.53,2.79-3.51,2.55-2.1,5.85-3.34,9.24-3.26l-.09,2.68-.02,2.43,1.43-6.28c-.85-.12-1.67-.16-2.51-.22-.15,0-.32-.01-.39-.16L21.87.1c.08-.1.21-.13.28-.07.07.05.06.17.03.28l-1.71,6.7,1.2.08,1.6.13s.05.13,0,.19c-.86.97-1.54,2.01-2.15,3.14l-2.07,3.75c-.05.07.05.11.07.01l1.14-1.34,1.93-2.21,2.3.83-1.77,4.57,1.09-1.35c.94-1.29,1.71-2.67,2.42-4.1l-2.81-1.25,6.19-4.39,3.2-2.21c.05-.04.13-.07.17-.06.05.03.07.12.02.2l-3.86,5.93,2.04.75.78.33-2.75,2.4-4.46,3.99,3.96-1.96c.06-.03.11-.06.15-.06.06,0,.12.04.17.1l.94,1.21c-1.06,1.44-2.11,2.84-3.25,4.2-.03.03-.08.06-.09.07-.03.02-.02.05,0,.06.09.03.1-.07.12-.09,1.76-1.39,3.41-2.83,5.1-4.4l-1.73-1.79c-.06-.06-.11-.15-.14-.27l4.08-1.38c2.02-.69,4-1.29,6.09-1.7.2-.04.38-.09.57,0-.34.45-.72.78-1.13,1.14-1.13,1.02-2.29,1.96-3.52,2.86l-.43.38L37.69,16.7Z"
      />
    </Svg>
  );
}

const STATUS_STYLE: Record<
  HealthStatusLevel,
  { labelKey: MessageKey; color: string; bg: string; border: string }
> = {
  normal: { labelKey: 'body.health.optimal', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  warning: { labelKey: 'body.health.watch', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  critical: { labelKey: 'body.health.attention', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

// Variante oscura de los chips de estado (el color de acento se mantiene; fondo/borde se oscurecen).
function statusStyle(status: HealthStatusLevel, colors: Palette, scheme: Scheme) {
  const base = STATUS_STYLE[status];
  if (scheme !== 'dark') return base;
  const soft = { normal: colors.successSoft, warning: colors.warningSoft, critical: colors.dangerSoft }[status];
  const accent = { normal: colors.success, warning: colors.warning, critical: colors.danger }[status];
  return { ...base, color: accent, bg: soft, border: `${accent}66` };
}

const MOOD_OPTIONS: {
  value: 1 | 2 | 3 | 4 | 5;
  labelKey: MessageKey;
  tag: string;
  status: HealthStatusLevel;
}[] = [
    { value: 5, labelKey: 'body.mood.5', tag: '5/5', status: 'normal' },
    { value: 4, labelKey: 'body.mood.4', tag: '4/5', status: 'normal' },
    { value: 3, labelKey: 'body.mood.3', tag: '3/5', status: 'warning' },
    { value: 2, labelKey: 'body.mood.2', tag: '2/5', status: 'warning' },
    { value: 1, labelKey: 'body.mood.1', tag: '1/5', status: 'critical' },
  ];

// Los valores (en inglés) se envían al backend y los usa la voz; los valores heredados en español se
// normalizan con `displaySymptom` al leerlos.
const NO_SYMPTOM = 'None';
const SYMPTOM_CHIPS = ['None', 'Zero-G dizziness', 'Congestion', 'Fatigue', 'Headache'];
const SYMPTOM_LABEL_KEYS: Record<string, MessageKey> = {
  None: 'body.symptom.none',
  'Zero-G dizziness': 'body.symptom.dizzy',
  Congestion: 'body.symptom.congestion',
  Fatigue: 'body.symptom.fatigue',
  Headache: 'body.symptom.headache',
};

/** Símbolos guardados (inglés o español heredado) → valores en inglés, sin duplicados. */
function normalizeSymptoms(list: string[]): string[] {
  const out = [...new Set(list.map(displaySymptom))];
  return out.length > 0 ? out : [NO_SYMPTOM];
}

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
  const { colors, scheme } = useAppTheme();
  const fill = status ? STATUS_STYLE[status].color : scheme === 'dark' ? colors.border : '#cbd5e1';

  return (
    <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-trauma-nightAlt">
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
  const { environment, healthChecks, submitHealthCheck } = useMission();
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  const iconInk = isDark ? colors.text : '#0f172a';
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
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(todayCheck?.mood ?? 4);
  const [symptoms, setSymptoms] = useState<string[]>(normalizeSymptoms(todayCheck?.symptoms ?? []));
  const [notes, setNotes] = useState(todayCheck?.notes ?? '');
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  // Sincroniza el formulario cuando llega o cambia el registro guardado de hoy
  const [syncedTodayCheck, setSyncedTodayCheck] = useState<DailyHealthCheck | undefined>(todayCheck);
  if (todayCheck && todayCheck !== syncedTodayCheck) {
    setSyncedTodayCheck(todayCheck);
    setGlucoseText(todayCheck.bloodSugarMgDl != null ? String(todayCheck.bloodSugarMgDl) : '');
    setSysText(todayCheck.systolicBp != null ? String(todayCheck.systolicBp) : '');
    setDiaText(todayCheck.diastolicBp != null ? String(todayCheck.diastolicBp) : '');
    setTempText(todayCheck.temperatureC != null ? String(todayCheck.temperatureC) : '');
    setMood(todayCheck.mood);
    setSymptoms(normalizeSymptoms(todayCheck.symptoms));
    setNotes(todayCheck.notes ?? '');
  }

  // Dictado por voz: rellena los campos (durante el render) y se consume una sola vez; no guarda.
  const { healthIntent, consumeHealthIntent } = useVoice();
  const [handledVoiceNonce, setHandledVoiceNonce] = useState(0);
  if (healthIntent && healthIntent.nonce !== handledVoiceNonce) {
    setHandledVoiceNonce(healthIntent.nonce);
    const f = healthIntent.fields;
    if (f.bloodSugarMgDl !== undefined) setGlucoseText(String(f.bloodSugarMgDl));
    if (f.systolicBp !== undefined) setSysText(String(f.systolicBp));
    if (f.diastolicBp !== undefined) setDiaText(String(f.diastolicBp));
    if (f.temperatureC !== undefined) setTempText(String(f.temperatureC));
    if (f.mood !== undefined) setMood(f.mood);
    if (f.symptoms !== undefined && f.symptoms.length > 0) setSymptoms(normalizeSymptoms(f.symptoms));
    if (f.notes !== undefined) setNotes(f.notes);
  }
  useEffect(() => {
    if (healthIntent) consumeHealthIntent(healthIntent.nonce);
  }, [healthIntent, consumeHealthIntent]);

  const glucose = parseNum(glucoseText);
  const sys = parseNum(sysText);
  const dia = parseNum(diaText);
  const temp = parseNum(tempText);

  const evaluation = useMemo(() => {
    const sGlucose = evalBloodSugar(glucose);
    const sBp = evalBloodPressure(sys, dia);
    const sTemp = evalTemperature(temp);
    const sMood = MOOD_OPTIONS.find((m) => m.value === mood)?.status ?? 'normal';

    const levels = [sGlucose, sBp, sTemp, sMood].filter(
      (x): x is HealthStatusLevel => x !== null
    );

    let overall: HealthStatusLevel = 'normal';
    if (levels.includes('critical')) overall = 'critical';
    else if (levels.includes('warning')) overall = 'warning';

    const actions: string[] = [];
    if (sGlucose === 'critical') {
      actions.push(t('body.health.actGlucoseCritical'));
    } else if (sGlucose === 'warning') {
      actions.push(t('body.health.actGlucoseWarning'));
    }

    if (sBp === 'critical') {
      actions.push(t('body.health.actBpCritical'));
    } else if (sBp === 'warning') {
      actions.push(t('body.health.actBpWarning'));
    }

    if (sTemp === 'critical') {
      actions.push(t('body.health.actTempCritical'));
    } else if (sTemp === 'warning') {
      actions.push(t('body.health.actTempWarning'));
    }

    if (sMood === 'critical' || sMood === 'warning') {
      actions.push(t('body.health.actMood'));
    }

    const recommendation =
      actions.length > 0
        ? actions[0]
        : t('body.health.actNone');

    const completedCount =
      (glucose !== null ? 1 : 0) +
      (sys !== null || dia !== null ? 1 : 0) +
      (temp !== null ? 1 : 0) +
      1; // ánimo siempre tiene valor seleccionado

    return { sGlucose, sBp, sTemp, sMood, overall, recommendation, completedCount };
  }, [glucose, sys, dia, temp, mood, t]);

  const toggleSymptom = (sym: string) => {
    if (sym === NO_SYMPTOM) {
      setSymptoms([NO_SYMPTOM]);
      return;
    }
    setSymptoms((prev) => {
      const cleaned = prev.filter((s) => s !== NO_SYMPTOM);
      if (cleaned.includes(sym)) {
        const next = cleaned.filter((s) => s !== sym);
        return next.length === 0 ? [NO_SYMPTOM] : next;
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
      sleepHours: todayCheck?.sleepHours ?? null,
      mood,
      symptoms,
      notes: notes.trim(),
      overallStatus: evaluation.overall,
      recommendation: evaluation.recommendation,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2600);
  };

  const completionPct = Math.round((evaluation.completedCount / 4) * 100);

  const renderHelp = (key: string, text: string) =>
    openHelp === key ? (
      <View className="mt-2.5 rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt p-2.5">
        <Text className="font-mono text-[10px] leading-4 text-slate-600 dark:text-trauma-nightMuted">{text}</Text>
      </View>
    ) : null;

  const summaryItems: { id: string; label: string; status: HealthStatusLevel | null }[] = [
    { id: 'glucose', label: t('body.health.glucose'), status: evaluation.sGlucose },
    { id: 'bp', label: t('body.health.bpShort'), status: evaluation.sBp },
    { id: 'temp', label: t('body.health.tempShort'), status: evaluation.sTemp },
    { id: 'mood', label: t('body.health.mood'), status: evaluation.sMood },
  ];

  return (
    <View className="pb-4">
      {/* Tarjeta Hero Espacial del Cuestionario Diario */}
      <View
        style={{ backgroundColor: '#060b19', position: 'relative' }}
        className="mb-3.5 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-trauma-nightLine shadow-md">
        <EnvironmentBannerBackdrop env={environment} />

        <View className="p-4">
          <View>
            <Text
              style={{
                textShadowColor: 'rgba(6, 11, 25, 0.85)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
              className="font-mono text-sm font-extrabold text-white">
              {t('body.health.title')}
            </Text>
            <View className="mt-0.5 flex-row items-center">
              <Clock size={10} color="#e2e8f0" />
              <Text
                style={{
                  textShadowColor: 'rgba(6, 11, 25, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
                className="ml-1 font-mono text-[9.5px] text-slate-100">
                {todayCheck
                  ? t('body.health.updated', { time: todayCheck.recordedAt })
                  : t('body.health.pending')}
              </Text>
            </View>
          </View>

          {/* Barra de progreso del chequeo de hoy */}
          <View className="mt-3">
            <View className="mb-1 flex-row items-center justify-between">
              <Text
                style={{
                  textShadowColor: 'rgba(6, 11, 25, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
                className="font-mono text-[9.5px] font-bold text-sky-200">
                {t('body.health.progress', { count: evaluation.completedCount })}
              </Text>
              <Text
                style={{
                  textShadowColor: 'rgba(6, 11, 25, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}
                className="font-mono text-[9.5px] font-bold text-white">
                {completionPct}%
              </Text>
            </View>
            <View
              style={{ backgroundColor: 'rgba(6, 11, 25, 0.48)' }}
              className="h-1.5 overflow-hidden rounded-full">
              <View
                style={{ width: `${completionPct}%`, backgroundColor: '#58d5f7' }}
                className="h-full rounded-full"
              />
            </View>
          </View>

          {/* Resumen visual de 4 indicadores */}
          <View className="mt-3 flex-row gap-1.5">
            {summaryItems.map((it) => {
              const dotColor = it.status ? STATUS_STYLE[it.status].color : '#94a3b8';
              return (
                <View
                  key={it.id}
                  style={{
                    backgroundColor: 'rgba(6, 11, 25, 0.56)',
                    borderColor: 'rgba(255, 255, 255, 0.22)',
                    borderWidth: 1,
                  }}
                  className="flex-1 flex-row items-center justify-center rounded-lg py-1">
                  <View
                    style={{ backgroundColor: dotColor }}
                    className="mr-1 h-1.5 w-1.5 rounded-full"
                  />
                  <Text className="font-mono text-[8.5px] font-bold text-slate-100" numberOfLines={1}>
                    {it.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* 1. Azúcar en sangre */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950">
              <GlucosaIcon size={16} color={colors.accentDeep} />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                {t('body.health.bloodSugar')}
              </Text>
              <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.health.bloodSugarGoal')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setOpenHelp(openHelp === 'glucose' ? null : 'glucose')}
            hitSlop={8}>
            <HelpCircle size={15} color={colors.textSubtle} />
          </Pressable>
        </View>

        <View className="mt-2.5 flex-row items-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt px-3 py-2">
          <TextInput
            value={glucoseText}
            onChangeText={setGlucoseText}
            keyboardType="numeric"
            placeholder={t('body.health.glucosePh')}
            placeholderTextColor={colors.textSubtle}
            className="flex-1 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk"
          />
          <Text className="font-mono text-[10px] font-bold text-slate-400 dark:text-trauma-nightSubtle">mg/dL</Text>
        </View>

        <View className="mt-2 flex-row gap-1.5">
          {['85', '95', '110', '145'].map((val) => {
            const active = glucoseText.trim() === val;
            return (
              <Pressable
                key={val}
                onPress={() => setGlucoseText(val)}
                className={`flex-1 items-center rounded-lg border py-1 ${active
                  ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                  : 'border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                  }`}>
                <Text className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-trauma-nightInk">{val}</Text>
              </Pressable>
            );
          })}
        </View>
        <MetricRangeBar value={glucose} min={40} max={200} status={evaluation.sGlucose} />
        {renderHelp(
          'glucose',
          t('body.health.glucoseHelp')
        )}
      </View>

      {/* 2. Presión arterial */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950">
              <FreqIcon size={16} color="#ef4444" />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                {t('body.health.bp')}
              </Text>
              <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.health.bpGoal')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setOpenHelp(openHelp === 'bp' ? null : 'bp')}
            hitSlop={8}>
            <HelpCircle size={15} color={colors.textSubtle} />
          </Pressable>
        </View>

        <View className="mt-2.5 flex-row gap-2">
          <View className="flex-1 flex-row items-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt px-3 py-2">
            <TextInput
              value={sysText}
              onChangeText={setSysText}
              keyboardType="numeric"
              placeholder={t('body.health.sysPh')}
              placeholderTextColor={colors.textSubtle}
              className="flex-1 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk"
            />
            <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">mmHg</Text>
          </View>
          <View className="flex-1 flex-row items-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt px-3 py-2">
            <TextInput
              value={diaText}
              onChangeText={setDiaText}
              keyboardType="numeric"
              placeholder={t('body.health.diaPh')}
              placeholderTextColor={colors.textSubtle}
              className="flex-1 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk"
            />
            <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">mmHg</Text>
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
                className={`flex-1 items-center rounded-lg border py-1 ${active
                  ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                  : 'border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                  }`}>
                <Text className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-trauma-nightInk">
                  {preset.s}/{preset.d}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <MetricRangeBar value={sys} min={70} max={160} status={evaluation.sBp} />
        {renderHelp(
          'bp',
          t('body.health.bpHelp')
        )}
      </View>

      {/* 3. Temperatura */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950">
              <TermoIcon size={16} color={colors.warning} />
            </View>
            <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">{t('body.health.temp')}</Text>
          </View>
          <Pressable
            onPress={() => setOpenHelp(openHelp === 'temp' ? null : 'temp')}
            hitSlop={8}>
            <HelpCircle size={15} color={colors.textSubtle} />
          </Pressable>
        </View>

        <View className="mt-2.5 flex-row items-center rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt px-3 py-2">
          <TextInput
            value={tempText}
            onChangeText={setTempText}
            keyboardType="decimal-pad"
            placeholder="36.6"
            placeholderTextColor={colors.textSubtle}
            className="flex-1 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk"
          />
          <Text className="font-mono text-[10px] font-bold text-slate-400 dark:text-trauma-nightSubtle">°C</Text>
        </View>

        <View className="mt-2 flex-row gap-1.5">
          {['36.5', '36.8'].map((v) => (
            <Pressable
              key={v}
              onPress={() => setTempText(v)}
              className={`flex-1 items-center rounded-lg border py-1 ${tempText.trim() === v
                ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                : 'border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                }`}>
              <Text className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-trauma-nightInk">{v}°</Text>
            </Pressable>
          ))}
        </View>
        <MetricRangeBar value={temp} min={34.5} max={39.5} status={evaluation.sTemp} />
        {renderHelp(
          'temp',
          t('body.health.tempHelp')
        )}
      </View>

      {/* 4. Estado de ánimo y salud conductual */}
      <View className="mb-2.5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950">
              <AnimoIcon size={16} color={colors.success} />
            </View>
            <View>
              <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">{t('body.health.moodTitle')}</Text>
              <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">{t('body.health.moodSub')}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setOpenHelp(openHelp === 'mood' ? null : 'mood')}
            hitSlop={8}>
            <HelpCircle size={15} color={colors.textSubtle} />
          </Pressable>
        </View>

        <View className="mt-2.5 flex-row gap-1.5">
          {MOOD_OPTIONS.map((opt) => {
            const active = mood === opt.value;
            const st = statusStyle(opt.status, colors, scheme);
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMood(opt.value)}
                style={
                  active
                    ? { backgroundColor: st.bg, borderColor: st.color, borderWidth: 1.5 }
                    : undefined
                }
                className={`flex-1 items-center rounded-xl py-2 ${active ? '' : 'border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                  }`}>
                <Text
                  style={active ? { color: st.color } : undefined}
                  className={`font-mono text-[9.5px] font-bold ${active ? '' : 'text-slate-600 dark:text-trauma-nightMuted'}`}
                  numberOfLines={1}>
                  {t(opt.labelKey)}
                </Text>
                <Text className="mt-0.5 font-mono text-[8px] text-slate-400 dark:text-trauma-nightSubtle">{opt.tag}</Text>
              </Pressable>
            );
          })}
        </View>
        {renderHelp(
          'mood',
          t('body.health.moodHelp')
        )}
      </View>

      {/* 5. Síntomas frecuentes y notas */}
      <View className="mb-3 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
        <View className="flex-row items-center">
          <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-950">
            <EstresIcon size={16} color="#ea580c" />
          </View>
          <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">{t('body.health.symptoms')}</Text>
        </View>
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          {SYMPTOM_CHIPS.map((sym) => {
            const active = symptoms.includes(sym);
            return (
              <Pressable
                key={sym}
                onPress={() => toggleSymptom(sym)}
                className={`rounded-xl border px-2.5 py-1.5 ${active
                  ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt'
                  : 'border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt'
                  }`}>
                <Text
                  className={`font-mono text-[10px] font-bold ${active ? 'text-trauma-ink dark:text-trauma-nightInk' : 'text-slate-600 dark:text-trauma-nightMuted'
                    }`}>
                  {SYMPTOM_LABEL_KEYS[sym] ? t(SYMPTOM_LABEL_KEYS[sym]) : sym}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-2.5 rounded-xl border border-slate-200 dark:border-trauma-nightLine bg-[#f7f7f7] dark:bg-trauma-nightAlt px-3 py-2">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('body.health.notePlaceholder')}
            placeholderTextColor={colors.textSubtle}
            className="font-mono text-[11px] text-slate-700 dark:text-trauma-nightInk"
          />
        </View>
        <View className="mt-2">
          <DictationButton
            label={t('body.health.dictate')}
            onText={(text) => setNotes((prev) => (prev ? `${prev} ${text}` : text))}
          />
        </View>
      </View>

      {/* Botón guardar / actualizar hoy */}
      <Pressable
        onPress={handleSave}
        className="flex-row items-center justify-center rounded-2xl border border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-trauma-nightAlt py-3.5 shadow-xs active:opacity-80">
        <Check size={15} color={iconInk} strokeWidth={2.5} />
        <Text className="ml-1.5 font-mono text-xs font-extrabold text-trauma-ink dark:text-trauma-nightInk">
          {savedBanner
            ? t('body.health.saved')
            : todayCheck
              ? t('body.health.update')
              : t('body.health.save')}
        </Text>
      </Pressable>

      {/* Historial de evaluaciones recientes */}
      {healthChecks.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('body.health.history', { count: healthChecks.length })}
          </Text>
          <View className="gap-2">
            {healthChecks.slice(0, 5).map((item: DailyHealthCheck) => (
              <View
                key={item.id}
                className="rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3 shadow-xs">
                <Text className="font-mono text-[10px] font-bold text-slate-500 dark:text-trauma-nightMuted">
                  {item.dateIso === todayIso
                    ? t('body.health.todayAt', { time: item.recordedAt })
                    : item.recordedAt}
                </Text>
                <Text className="mt-1 font-mono text-[11px] font-bold text-slate-800 dark:text-trauma-nightInk">
                  {[
                    item.bloodSugarMgDl !== null
                      ? t('body.health.histGlucose', { value: item.bloodSugarMgDl })
                      : null,
                    item.systolicBp !== null && item.diastolicBp !== null
                      ? t('body.health.histBp', { sys: item.systolicBp, dia: item.diastolicBp })
                      : null,
                    item.temperatureC !== null
                      ? `${formatNumber(item.temperatureC, locale, { maximumFractionDigits: 1 })}°C`
                      : null,
                    item.sleepHours !== null
                      ? t('body.health.histSleep', {
                        value: formatNumber(item.sleepHours, locale, { maximumFractionDigits: 1 }),
                      })
                      : t('body.health.histBehavior'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {item.notes ? (
                  <Text className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-trauma-nightMuted">
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
