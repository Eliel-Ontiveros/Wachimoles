import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Path, Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Footprints,
  Heart,
  Activity,
  ChevronRight,
  Clock,
  X,
  TrendingUp,
  History,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Moon,
} from 'lucide-react-native';
import { DashboardSample } from '../../types/vital-signs';
import { EnvironmentSelector } from './EnvironmentSelector';
import { SpaceJourneyTimeline } from './SpaceJourneyTimeline';
import { useMission } from './mission-context';
import { useVoice } from '@/voice/voice-context';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import type { Locale, MessageKey } from '@/i18n/messages';
import { useAppTheme, type Palette } from '@/theme';

type TFn = (key: MessageKey, params?: Record<string, string | number>) => string;

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// Plantilla de ciclo cardíaco normalizado
const BEAT_TEMPLATE = [
  0.5, 0.5, 0.52, 0.56, 0.54, 0.5, 0.5, 0.44, 0.98, 0.1, 0.48, 0.5, 0.5,
  0.54, 0.62, 0.58, 0.5, 0.5, 0.5, 0.5,
];

const BEAT_WIDTH = 96;

// Osciloscopio de ECG continuo sincronizado con el período del latido (60000 / BPM ms)
function RealtimeEcgChart({
  bpm,
  isAvailable,
}: {
  bpm?: number | null;
  isAvailable: boolean;
}) {
  const { colors, scheme } = useAppTheme();
  const gridColor = scheme === 'dark' ? colors.border : '#f1f5f9';
  const [containerWidth, setContainerWidth] = useState(0);
  const h = 96;
  const grid = 16;

  // Desplazamiento continuo del trazado
  const [scrollAnim] = useState(() => new Animated.Value(0));
  // Pulso de brillo del trazado cuando el complejo QRS cruza el sensor
  const [waveGlowAnim] = useState(() => new Animated.Value(1));

  // Tiempo exacto de 1 latido = 60000 / BPM (ej: 60 Lpm = 1000 ms, 120 Lpm = 500 ms)
  const effectiveBpm = bpm && bpm >= 30 && bpm <= 220 ? bpm : 60;
  const beatPeriodMs = Math.round((60 / effectiveBpm) * 1000);

  useEffect(() => {
    scrollAnim.setValue(0);

    if (isAvailable && bpm && bpm > 0) {
      // 1. Desplazamiento continuo de la onda sincronizado exactamente al período BPM
      const ecgLoop = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: -BEAT_WIDTH,
          duration: beatPeriodMs,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );

      // 2. Destello sutil de amplitud en el punto del latido
      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(waveGlowAnim, {
            toValue: 1.15,
            duration: Math.round(beatPeriodMs * 0.2),
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(waveGlowAnim, {
            toValue: 1,
            duration: Math.round(beatPeriodMs * 0.8),
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );

      ecgLoop.start();
      glowLoop.start();

      return () => {
        ecgLoop.stop();
        glowLoop.stop();
      };
    } else {
      // Si el sensor no tiene pulso disponible: línea de búsqueda lenta y atenuada
      const waitLoop = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: -BEAT_WIDTH,
          duration: 3800,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      waitLoop.start();
      return () => waitLoop.stop();
    }
  }, [isAvailable, bpm, beatPeriodMs, scrollAnim, waveGlowAnim]);

  // Generación matemática de la cadena continua de ondas repetidas
  const { pathD, totalWidth } = useMemo(() => {
    if (containerWidth <= 0) return { pathD: '', totalWidth: 0 };

    const neededBeats = Math.ceil(containerWidth / BEAT_WIDTH) + 3;
    const points: string[] = [];

    for (let beatIdx = 0; beatIdx < neededBeats; beatIdx++) {
      const offsetX = beatIdx * BEAT_WIDTH;
      const count = BEAT_TEMPLATE.length;

      for (let i = 0; i < count; i++) {
        const x = offsetX + (i / (count - 1)) * BEAT_WIDTH;
        const normY = isAvailable ? BEAT_TEMPLATE[i] : 0.5;
        const y = (1 - normY) * h;

        if (beatIdx === 0 && i === 0) {
          points.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
        } else {
          points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
      }
    }

    return {
      pathD: points.join(' '),
      totalWidth: neededBeats * BEAT_WIDTH,
    };
  }, [containerWidth, isAvailable]);

  return (
    <View
      style={{ height: h, marginTop: 8, overflow: 'hidden' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && (
        <View style={{ width: containerWidth, height: h }}>
          {/* Cuadrícula clínica milimétrica (grid) */}
          <Svg width={containerWidth} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
            {Array.from({ length: Math.floor(containerWidth / grid) + 1 }, (_, i) => (
              <Line
                key={`v${i}`}
                x1={i * grid}
                y1={0}
                x2={i * grid}
                y2={h}
                stroke={gridColor}
                strokeWidth={0.7}
              />
            ))}
            {Array.from({ length: Math.floor(h / grid) + 1 }, (_, i) => (
              <Line
                key={`h${i}`}
                x1={0}
                y1={i * grid}
                x2={containerWidth}
                y2={i * grid}
                stroke={gridColor}
                strokeWidth={0.7}
              />
            ))}
            {/* Línea guía central */}
            <Line
              x1={0}
              y1={h / 2}
              x2={containerWidth}
              y2={h / 2}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="2,3"
            />
          </Svg>

          {/* Trazado continuo sincronizado al ritmo cardíaco */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: totalWidth,
              height: h,
              transform: [{ translateX: scrollAnim }, { scaleY: isAvailable ? waveGlowAnim : 1 }],
            }}>
            <Svg width={totalWidth} height={h}>
              <Path
                d={pathD}
                fill="none"
                stroke={isAvailable ? colors.accentDeep : colors.textSubtle}
                strokeWidth={isAvailable ? 2.1 : 1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>

          {/* Punto de barrido / haz de luz activo que marca el latido */}
          {isAvailable && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 24,
                height: h,
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
                borderRightWidth: 1.5,
                borderRightColor: 'rgba(56, 189, 248, 0.45)',
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

type HistoryMetric = 'heart_rate' | 'spo2' | 'stress' | 'sleep';

interface DailySummary {
  dateKey: string;
  dateLabel: string;
  /** Día relativo, para etiquetas cortas independientes del idioma. */
  rel: 'today' | 'yesterday' | null;
  count: number;
  avg: number;
  max: number;
  maxTime: string;
  min: number;
  minTime: string;
}

function formatHourMinute(isoString: string, locale: Locale): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  return formatTime(d, locale) || '--:--';
}

function formatDayLabel(
  dateKey: string,
  locale: Locale,
  t: TFn
): { label: string; rel: 'today' | 'yesterday' | null } {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return { label: dateKey, rel: null };

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const day = new Date(y, m - 1, d);
  const shortDate = formatDate(day, locale, { day: 'numeric', month: 'short' });
  if (dateKey === todayKey) return { label: `${t('vital.day.today')} · ${shortDate}`, rel: 'today' };
  if (dateKey === yesterdayKey) {
    return { label: `${t('vital.day.yesterday')} · ${shortDate}`, rel: 'yesterday' };
  }
  return { label: formatDate(day, locale, { day: 'numeric', month: 'short', year: 'numeric' }), rel: null };
}

function groupSamplesByDay(samples: DashboardSample[], locale: Locale, t: TFn): DailySummary[] {
  const groups = new Map<string, DashboardSample[]>();

  for (const s of samples) {
    const dt = new Date(s.measuredAt);
    if (isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
    const list = groups.get(key);
    if (list) {
      list.push(s);
    } else {
      groups.set(key, [s]);
    }
  }

  const summaries: DailySummary[] = [];
  for (const [dateKey, list] of groups.entries()) {
    const isSleep = list[0].metric === 'sleep';
    let maxSample = list[0];
    let minSample = list[0];
    let sum = 0;

    for (const item of list) {
      sum += item.value;
      if (item.value > maxSample.value) maxSample = item;
      if (item.value < minSample.value) minSample = item;
    }

    const dayLabel = formatDayLabel(dateKey, locale, t);
    summaries.push({
      dateKey,
      dateLabel: dayLabel.label,
      rel: dayLabel.rel,
      count: list.length,
      avg: isSleep
        ? Math.round((sum / list.length) * 10) / 10
        : Math.round(sum / list.length),
      max: isSleep ? maxSample.value : Math.round(maxSample.value),
      maxTime: formatHourMinute(maxSample.measuredAt, locale),
      min: isSleep ? minSample.value : Math.round(minSample.value),
      minTime: formatHourMinute(minSample.measuredAt, locale),
    });
  }

  return summaries.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

function formatMetricValue(metric: HistoryMetric, value: number): string {
  return metric === 'sleep' ? value.toFixed(1) : String(Math.round(value));
}

const METRIC_META: Record<
  HistoryMetric,
  {
    titleKey: MessageKey;
    tabKey: MessageKey;
    unitKey: MessageKey | null;
    unit: string;
    accent: string;
    softBg: string;
    softBgDark: string;
    minBound: number;
    maxBound: number;
  }
> = {
  heart_rate: {
    titleKey: 'vital.title.heart_rate',
    tabKey: 'vital.tab.heart_rate',
    unitKey: 'vital.unit.bpm',
    unit: 'Lpm',
    accent: '#ef4444',
    softBg: '#fef2f2',
    softBgDark: '#3a1216',
    minBound: 30,
    maxBound: 220,
  },
  spo2: {
    titleKey: 'vital.title.spo2',
    tabKey: 'vital.tab.spo2',
    unitKey: null,
    unit: '%',
    accent: '#0284c7',
    softBg: '#f0f9ff',
    softBgDark: '#0c2a3d',
    minBound: 70,
    maxBound: 100,
  },
  stress: {
    titleKey: 'vital.title.stress',
    tabKey: 'vital.tab.stress',
    unitKey: null,
    unit: '/100',
    accent: '#f97316',
    softBg: '#fff7ed',
    softBgDark: '#3a1d0a',
    minBound: 0,
    maxBound: 100,
  },
  sleep: {
    titleKey: 'vital.title.sleep',
    tabKey: 'vital.tab.sleep',
    unitKey: null,
    unit: 'h',
    accent: '#7c3aed',
    softBg: '#f5f3ff',
    softBgDark: '#241a45',
    minBound: 0,
    maxBound: 12,
  },
};

// Esqueleto animado de carga mientras obtiene historial de métricas
function HistorySkeleton() {
  const [pulseAnim] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={{ opacity: pulseAnim }}>
      <View className="flex-row justify-between gap-2">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="h-20 flex-1 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-slate-100/80 dark:bg-trauma-nightAlt p-3"
          />
        ))}
      </View>

      <View className="mt-3.5 h-32 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-slate-100/80 dark:bg-trauma-nightAlt p-3.5" />

      <View className="mt-4 gap-3 pb-10">
        {[0, 1].map((i) => (
          <View
            key={i}
            className="h-28 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-slate-100/80 dark:bg-trauma-nightAlt p-3.5"
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Modal de historial agrupado por día para Pulso, Oxígeno y Estrés
function VitalHistoryModal({
  visible,
  metric,
  onSelectMetric,
  onClose,
  history,
  currentValue,
  loading,
}: {
  visible: boolean;
  metric: HistoryMetric;
  onSelectMetric: (m: HistoryMetric) => void;
  onClose: () => void;
  history: DashboardSample[];
  currentValue: number | null;
  loading: boolean;
}) {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const meta = METRIC_META[metric];
  const unitLabel = meta.unitKey ? t(meta.unitKey) : meta.unit;
  const gridColor = scheme === 'dark' ? colors.border : '#f1f5f9';
  const closeIconColor = scheme === 'dark' ? colors.textMuted : '#475569';

  const validSamples = useMemo(() => {
    return history.filter((s) => s.metric === metric && Number(s.value) > 0);
  }, [history, metric]);

  const dailySummaries = useMemo(
    () => groupSamplesByDay(validSamples, locale, t),
    [validSamples, locale, t]
  );

  const stats = useMemo(() => {
    if (validSamples.length === 0) {
      return { min: 0, max: 0, avg: 0, latest: currentValue || 0 };
    }
    const vals = validSamples.map((s) =>
      metric === 'sleep' ? s.value : Math.round(s.value)
    );
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const avg =
      metric === 'sleep'
        ? Math.round((sum / vals.length) * 10) / 10
        : Math.round(sum / vals.length);
    const latest = currentValue ?? vals[0];
    return { min, max, avg, latest };
  }, [metric, validSamples, currentValue]);

  const chartPoints = useMemo(() => {
    if (chartWidth <= 0 || validSamples.length < 2) return '';

    const pointsData = [...validSamples.slice(0, 18)].reverse();
    const minVal = Math.max(meta.minBound, stats.min - 5);
    const maxVal = Math.min(meta.maxBound, stats.max + 5);
    const range = maxVal - minVal || 1;
    const h = 100;

    return pointsData
      .map((s, idx) => {
        const x = (idx / (pointsData.length - 1)) * (chartWidth - 20) + 10;
        const normY = (s.value - minVal) / range;
        const y = h - normY * (h - 24) - 12;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [chartWidth, validSamples, stats, meta]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: scheme === 'dark' ? colors.overlay : 'rgba(15,23,42,0.45)',
          justifyContent: 'flex-end',
        }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ height: '82%' }}>
          <View
            style={{ flex: 1 }}
            className="overflow-hidden rounded-t-3xl border-t border-slate-200 dark:border-trauma-nightLine bg-white dark:bg-trauma-night shadow-2xl">
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 dark:bg-trauma-nightLine" />

            {/* Cabecera del modal */}
            <View className="flex-row items-center justify-between border-b border-slate-100 dark:border-trauma-nightLine px-5 pb-3 pt-3">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: scheme === 'dark' ? meta.softBgDark : meta.softBg }}
                  className="mr-2.5 h-9 w-9 items-center justify-center rounded-xl">
                  {metric === 'heart_rate' ? (
                    <Heart size={18} color={meta.accent} fill={meta.accent} />
                  ) : metric === 'sleep' ? (
                    <Moon size={18} color={meta.accent} />
                  ) : (
                    <Activity size={18} color={meta.accent} />
                  )}
                </View>
                <View>
                  <Text className="font-mono text-base font-extrabold text-slate-900 dark:text-trauma-nightInk">
                    {t(meta.titleKey)}
                  </Text>
                  <Text className="font-mono text-[10px] text-slate-400 dark:text-trauma-nightSubtle">
                    {metric === 'sleep'
                      ? t('vital.history.subtitleSleep')
                      : t('vital.history.subtitleDefault')}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                accessibilityLabel={t('common.close')}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt active:bg-slate-200 dark:active:bg-trauma-nightLine">
                <X size={16} color={closeIconColor} />
              </Pressable>
            </View>

            {/* Pestañas para alternar entre métricas */}
            <View className="flex-row gap-2 px-5 pt-3">
              {(['heart_rate', 'spo2', 'stress', 'sleep'] as HistoryMetric[]).map((mKey) => {
                const active = mKey === metric;
                return (
                  <Pressable
                    key={mKey}
                    onPress={() => onSelectMetric(mKey)}
                    className={`flex-1 items-center rounded-xl border py-2 ${active
                      ? 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-cyan-950'
                      : 'border-slate-200 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt'
                      }`}>
                    <Text
                      className={`font-mono text-[10.5px] font-bold ${active ? 'text-trauma-ink dark:text-trauma-nightInk' : 'text-slate-500 dark:text-trauma-nightMuted'
                        }`}>
                      {t(METRIC_META[mKey].tabKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView className="flex-1 px-5 pt-3.5" showsVerticalScrollIndicator={false}>
              {loading ? (
                <HistorySkeleton />
              ) : (
                <>
                  {/* Tarjetas de Estadísticas Generales */}
                  <View className="flex-row justify-between gap-2">
                    <View className="flex-1 items-center rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400 dark:text-trauma-nightSubtle">{t('vital.stat.current')}</Text>
                      <Text className="font-mono text-lg font-extrabold text-slate-900 dark:text-trauma-nightInk">
                        {stats.latest ? formatMetricValue(metric, stats.latest) : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500 dark:text-trauma-nightMuted">{unitLabel}</Text>
                    </View>

                    <View className="flex-1 items-center rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400 dark:text-trauma-nightSubtle">{t('vital.stat.average')}</Text>
                      <Text className="font-mono text-lg font-extrabold text-sky-600 dark:text-sky-300">
                        {stats.avg ? formatMetricValue(metric, stats.avg) : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500 dark:text-trauma-nightMuted">{unitLabel}</Text>
                    </View>

                    <View className="flex-1 items-center rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400 dark:text-trauma-nightSubtle">{t('vital.stat.minMax')}</Text>
                      <Text className="mt-0.5 font-mono text-sm font-extrabold text-slate-900 dark:text-trauma-nightInk">
                        {stats.min && stats.max
                          ? `${formatMetricValue(metric, stats.min)} - ${formatMetricValue(metric, stats.max)}`
                          : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500 dark:text-trauma-nightMuted">{t('vital.stat.range')}</Text>
                    </View>
                  </View>

                  {/* Gráfica de tendencia */}
                  {validSamples.length >= 2 && (
                    <View className="mt-3.5 rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
                      <View className="mb-2 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <TrendingUp size={13} color={meta.accent} />
                          <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                            {t('vital.trend.title')}
                          </Text>
                        </View>
                        <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.trend.lastReadings', { count: Math.min(18, validSamples.length) })}
                        </Text>
                      </View>

                      <View
                        style={{ height: 100, width: '100%' }}
                        onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                        {chartWidth > 0 && chartPoints && (
                          <Svg width={chartWidth} height={100}>
                            <Defs>
                              <LinearGradient id="pulseLineGrad" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0%" stopColor={meta.accent} stopOpacity="0.4" />
                                <Stop offset="100%" stopColor={meta.accent} stopOpacity="0" />
                              </LinearGradient>
                            </Defs>
                            <Line x1={0} y1={22} x2={chartWidth} y2={22} stroke={gridColor} strokeWidth={1} />
                            <Line x1={0} y1={50} x2={chartWidth} y2={50} stroke={gridColor} strokeWidth={1} />
                            <Line x1={0} y1={78} x2={chartWidth} y2={78} stroke={gridColor} strokeWidth={1} />

                            <Polyline
                              points={chartPoints}
                              fill="none"
                              stroke={meta.accent}
                              strokeWidth={2.4}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Resumen agrupado por día */}
                  <View className="mt-4 pb-10">
                    <View className="mb-2.5 flex-row items-center">
                      <History size={13} color={colors.textMuted} />
                      <Text className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-trauma-nightInk">
                        {t(dailySummaries.length === 1 ? 'vital.daily.titleOne' : 'vital.daily.title', {
                          count: dailySummaries.length,
                        })}
                      </Text>
                    </View>

                    {dailySummaries.length === 0 ? (
                      <View className="items-center rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-[#f8fafc] dark:bg-trauma-nightAlt p-6">
                        <Text className="font-mono text-xs text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.daily.empty', { metric: t(meta.tabKey).toLowerCase() })}
                        </Text>
                      </View>
                    ) : (
                      dailySummaries.map((day) => (
                        <View
                          key={day.dateKey}
                          className="mb-3 rounded-2xl border border-slate-200/80 dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-3.5 shadow-xs">
                          <View className="mb-2.5 flex-row items-center justify-between border-b border-slate-100 dark:border-trauma-nightLine pb-2">
                            <Text className="font-mono text-xs font-extrabold text-slate-800 dark:text-trauma-nightInk">
                              {day.dateLabel}
                            </Text>
                            <View className="rounded-md bg-slate-100 dark:bg-trauma-nightAlt px-2 py-0.5">
                              <Text className="font-mono text-[9px] font-bold text-slate-500 dark:text-trauma-nightMuted">
                                {day.count}{' '}
                                {metric === 'sleep'
                                  ? t(day.count === 1 ? 'vital.count.record' : 'vital.count.records')
                                  : t(day.count === 1 ? 'vital.count.reading' : 'vital.count.readings')}
                              </Text>
                            </View>
                          </View>

                          {metric === 'sleep' ? (
                            <View className="flex-row items-center justify-between rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/60 p-3">
                              <View className="flex-row items-center">
                                <Moon size={16} color="#7c3aed" />
                                <Text className="ml-2 font-mono text-xs font-bold text-violet-800 dark:text-violet-200">
                                  {t('vital.sleep.totalDuration')}
                                </Text>
                              </View>
                              <Text className="font-mono text-lg font-extrabold text-violet-800 dark:text-violet-200">
                                {formatMetricValue(metric, day.max)} h
                              </Text>
                            </View>
                          ) : (
                            <View className="flex-row gap-2">
                              <View className="flex-1 rounded-xl border border-red-100 dark:border-red-900 bg-red-50/40 dark:bg-red-950/40 p-2.5">
                                <View className="flex-row items-center">
                                  <ArrowUpRight size={12} color={colors.danger} />
                                  <Text className="ml-0.5 font-mono text-[8.5px] font-bold uppercase text-red-600 dark:text-red-300">
                                    {t('vital.peak.high')}
                                  </Text>
                                </View>
                                <Text className="mt-1 font-mono text-sm font-extrabold text-slate-900 dark:text-trauma-nightInk">
                                  {formatMetricValue(metric, day.max)} <Text className="text-[9px] font-normal text-slate-500 dark:text-trauma-nightMuted">{unitLabel}</Text>
                                </Text>
                                <View className="mt-1 flex-row items-center">
                                  <Clock size={10} color={colors.textMuted} />
                                  <Text className="ml-1 font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">
                                    {day.maxTime}
                                  </Text>
                                </View>
                              </View>

                              <View className="flex-1 items-center justify-center rounded-xl border border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/50 p-2.5">
                                <Text className="font-mono text-[8.5px] font-bold uppercase text-sky-700 dark:text-sky-300">
                                  {t('vital.stat.average')}
                                </Text>
                                <Text className="mt-1 font-mono text-base font-extrabold text-sky-700 dark:text-sky-300">
                                  {formatMetricValue(metric, day.avg)}
                                </Text>
                                <Text className="mt-0.5 font-mono text-[8.5px] text-slate-500 dark:text-trauma-nightMuted">
                                  {t('vital.avg.ofDay', { unit: unitLabel })}
                                </Text>
                              </View>

                              <View className="flex-1 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40 p-2.5">
                                <View className="flex-row items-center">
                                  <ArrowDownRight size={12} color={colors.success} />
                                  <Text className="ml-0.5 font-mono text-[8.5px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                                    {t('vital.peak.low')}
                                  </Text>
                                </View>
                                <Text className="mt-1 font-mono text-sm font-extrabold text-slate-900 dark:text-trauma-nightInk">
                                  {formatMetricValue(metric, day.min)} <Text className="text-[9px] font-normal text-slate-500 dark:text-trauma-nightMuted">{unitLabel}</Text>
                                </Text>
                                <View className="mt-1 flex-row items-center">
                                  <Clock size={10} color={colors.textMuted} />
                                  <Text className="ml-1 font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">
                                    {day.minTime}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function formatSleepDuration(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getSleepShortDayLabel(day: DailySummary, t: TFn): string {
  if (day.rel === 'today') return t('vital.day.today');
  if (day.rel === 'yesterday') return t('vital.day.yesterday');
  const [, m, d] = day.dateKey.split('-');
  return m && d ? `${Number(d)}/${Number(m)}` : day.dateLabel;
}

function getSleepMeta(
  hours: number | null,
  t: TFn,
  locale: Locale,
  colors: Palette,
  scheme: 'light' | 'dark'
) {
  const dark = scheme === 'dark';
  const missing = (h: number) =>
    t('vital.sleep.missing', {
      hours: formatNumber(7 - h, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    });

  if (hours === null) {
    return {
      label: t('vital.sleep.noReading'),
      color: colors.textMuted,
      bg: colors.surfaceAlt,
      border: colors.border,
      summary: t('vital.sleep.waiting'),
      pointerPct: 0,
    };
  }

  let pointerPct: number;
  if (hours < 5.5) {
    const ratio = Math.max(0, Math.min(1, (hours - 2) / 3.5));
    pointerPct = 4 + ratio * 28;
    return {
      label: t('vital.sleep.deficit'),
      color: colors.danger,
      bg: colors.dangerSoft,
      border: dark ? '#5b1c22' : '#fecaca',
      summary: missing(hours),
      pointerPct,
    };
  }

  if (hours < 7) {
    const ratio = (hours - 5.5) / 1.5;
    pointerPct = 38 + ratio * 20;
    return {
      label: t('vital.sleep.watch'),
      color: colors.warning,
      bg: colors.warningSoft,
      border: dark ? '#5c430f' : '#fde68a',
      summary: missing(hours),
      pointerPct,
    };
  }

  const ratio = Math.max(0, Math.min(1, (hours - 7) / 3));
  pointerPct = 64 + ratio * 31;
  return {
    label: t('vital.sleep.optimal'),
    color: colors.success,
    bg: colors.successSoft,
    border: dark ? '#0f4a36' : '#a7f3d0',
    summary: hours > 9 ? t('vital.sleep.extended') : t('vital.sleep.inGoal'),
    pointerPct,
  };
}

function SleepSummaryCard({
  sleepHours,
  sleepHistory,
  onPress,
}: {
  sleepHours: number | null;
  sleepHistory: DashboardSample[];
  onPress: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors, scheme } = useAppTheme();
  const meta = getSleepMeta(sleepHours, t, locale, colors, scheme);

  const recentInfo = useMemo(() => {
    const days = groupSamplesByDay(sleepHistory, locale, t);
    if (days.length === 0) return { days: [] as DailySummary[], avg: null as number | null };
    const latestFive = days.slice(0, 5).reverse();
    const sum = latestFive.reduce((acc, d) => acc + d.max, 0);
    const avg = Math.round((sum / latestFive.length) * 10) / 10;
    return { days: latestFive, avg };
  }, [sleepHistory, locale, t]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t('vital.sleep.a11yHistory')}
      className="mb-4 rounded-2xl border border-violet-200/80 dark:border-violet-900 bg-white dark:bg-trauma-night p-4 shadow-md active:opacity-90">
      {/* Cabecera de sueño con estado clínico */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center pr-2">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50 dark:bg-violet-950">
            <Moon size={19} color="#7c3aed" />
          </View>
          <View className="flex-1">
            <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
              {t('vital.sleep.title')}
            </Text>
            <Text className="mt-0.5 font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">
              {t('vital.sleep.circadian')}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: meta.bg,
            borderColor: meta.border,
            borderWidth: 1,
          }}
          className="flex-row items-center rounded-full px-2.5 py-1">
          <View
            style={{ backgroundColor: meta.color }}
            className="mr-1.5 h-1.5 w-1.5 rounded-full"
          />
          <Text style={{ color: meta.color }} className="font-mono text-[9.5px] font-bold">
            {meta.label}
          </Text>
        </View>
      </View>

      {/* Lectura principal y promedio reciente */}
      <View className="mt-3 flex-row items-end justify-between">
        <View>
          <View className="flex-row items-baseline">
            <Text className="font-mono text-3xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
              {sleepHours !== null ? sleepHours.toFixed(1) : '--'}
            </Text>
            <Text className="ml-1 font-mono text-xs font-bold text-violet-700 dark:text-violet-300">h</Text>
            {sleepHours !== null && (
              <View className="ml-2 rounded-md bg-violet-50 dark:bg-violet-950 px-1.5 py-0.5">
                <Text className="font-mono text-[9.5px] font-bold text-violet-700 dark:text-violet-300">
                  {formatSleepDuration(sleepHours)}
                </Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted">{meta.summary}</Text>
        </View>

        {recentInfo.avg !== null && (
          <View className="items-end rounded-xl border border-violet-100 dark:border-violet-900 bg-violet-50/70 dark:bg-violet-950/70 px-2.5 py-1.5">
            <Text className="font-mono text-[8.5px] font-bold uppercase text-violet-600 dark:text-violet-300">
              {t('vital.sleep.avgShort', { count: recentInfo.days.length })}
            </Text>
            <Text className="font-mono text-xs font-extrabold text-violet-800 dark:text-violet-200">
              {recentInfo.avg.toFixed(1)} h
            </Text>
          </View>
        )}
      </View>

      {/* Escala clínica de sueño (Déficit / Vigilar / Óptimo) */}
      <View className="mt-3">
        <View className="relative h-2 flex-row items-center gap-1">
          <View
            style={{
              flex: 35,
              height: 6,
              borderRadius: 999,
              backgroundColor: '#ef4444',
              opacity: sleepHours !== null && sleepHours < 5.5 ? 1 : 0.24,
            }}
          />
          <View
            style={{
              flex: 25,
              height: 6,
              borderRadius: 999,
              backgroundColor: '#f59e0b',
              opacity: sleepHours !== null && sleepHours >= 5.5 && sleepHours < 7 ? 1 : 0.24,
            }}
          />
          <View
            style={{
              flex: 40,
              height: 6,
              borderRadius: 999,
              backgroundColor: '#10b981',
              opacity: sleepHours !== null && sleepHours >= 7 ? 1 : 0.24,
            }}
          />
          {sleepHours !== null && (
            <View
              style={{
                position: 'absolute',
                left: `${Math.max(4, Math.min(96, meta.pointerPct))}%`,
                top: -2,
                marginLeft: -6,
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: meta.color,
                borderWidth: 2,
                borderColor: colors.surface,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.25,
                shadowRadius: 2,
                elevation: 3,
              }}
            />
          )}
        </View>
        <View className="mt-1.5 flex-row justify-between">
          <Text className="font-mono text-[8.5px] font-semibold text-rose-600 dark:text-rose-300">&lt;5.5 h</Text>
          <Text className="font-mono text-[8.5px] font-semibold text-amber-600 dark:text-amber-300">5.5–6.9 h</Text>
          <Text className="font-mono text-[8.5px] font-semibold text-emerald-700 dark:text-emerald-300">
            {t('vital.sleep.scaleOptimal')}
          </Text>
        </View>
      </View>

      {/* Mini comparativa de últimas noches */}
      {recentInfo.days.length > 0 && (
        <View className="mt-3 rounded-xl border border-slate-100 dark:border-trauma-nightLine bg-slate-50/80 dark:bg-trauma-nightAlt px-2.5 py-2">
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
              {t('vital.sleep.lastNights')}
            </Text>
            <Text className="font-mono text-[8.5px] font-semibold text-violet-600 dark:text-violet-300">
              {recentInfo.days.length}{' '}
              {t(recentInfo.days.length === 1 ? 'vital.count.record' : 'vital.count.records')}
            </Text>
          </View>
          <View className="flex-row items-end justify-between gap-2">
            {recentInfo.days.map((day) => {
              const barPct = Math.max(18, Math.min(100, Math.round((day.max / 10) * 100)));
              const barColor =
                day.max < 5.5 ? '#ef4444' : day.max < 7 ? '#f59e0b' : '#7c3aed';
              return (
                <View key={day.dateKey} className="flex-1 items-center">
                  <Text className="mb-1 font-mono text-[8.5px] font-bold text-slate-600 dark:text-trauma-nightMuted">
                    {day.max.toFixed(1)}h
                  </Text>
                  <View className="h-9 w-full max-w-[22px] justify-end overflow-hidden rounded-md bg-slate-200/70 dark:bg-trauma-nightLine">
                    <View
                      style={{
                        height: `${barPct}%`,
                        backgroundColor: barColor,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                  </View>
                  <Text className="mt-1 font-mono text-[8px] text-slate-400 dark:text-trauma-nightSubtle">
                    {getSleepShortDayLabel(day, t)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Acción al historial */}
      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 dark:border-trauma-nightLine pt-2">
        <Text className="font-mono text-[9px] font-bold text-violet-700 dark:text-violet-300">
          {t('vital.sleep.tapHistory')}
        </Text>
        <ChevronRight size={12} color="#7c3aed" />
      </View>
    </Pressable>
  );
}

/** El servicio entrega "Hace N seg/min" o "A las HH:mm" en español: se re-expresa en el idioma activo. */
function localizeLastMeasured(text: string, t: TFn): string {
  const rel = /^Hace (\d+) (seg|min)$/.exec(text);
  if (rel) return t(rel[2] === 'seg' ? 'vital.ago.sec' : 'vital.ago.min', { n: rel[1] });
  const at = /^A las (.+)$/.exec(text);
  if (at) return t('vital.at', { time: at[1] });
  return text;
}

function MetricCard({
  label,
  value,
  percent,
  unit,
  onPress,
}: {
  label: string;
  value: string;
  percent: number;
  unit?: string;
  onPress?: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-md active:opacity-85">
      <View className="flex-row items-start justify-between">
        <Text className="h-8 font-mono text-xs text-trauma-ink dark:text-trauma-nightInk">{label}</Text>
        <ChevronRight size={13} color={colors.textSubtle} />
      </View>
      <View className="my-2 flex-row items-baseline">
        <Text className="font-mono text-4xl text-trauma-ink dark:text-trauma-nightInk">{value}</Text>
        {!!unit && <Text className="ml-1 font-mono text-[11px] text-trauma-muted dark:text-trauma-nightMuted">{unit}</Text>}
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-trauma-nightLine">
        <View
          className="h-full rounded-full bg-trauma-cyan"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </View>
      <Text className="mt-2 font-mono text-[8.5px] font-bold text-sky-600 dark:text-sky-300">
        {t('vital.metric.viewHistory')}
      </Text>
    </Pressable>
  );
}

export function VitalMonitorView() {
  const {
    vitals,
    getFullHistory,
    streakDays,
    missions,
    environment,
    treadmillRoutineActive,
    toggleTreadmillRoutine,
  } = useMission();

  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<HistoryMetric>('heart_rate');
  const [historySamples, setHistorySamples] = useState<DashboardSample[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyReqIdRef = useRef(0);

  const completedMissions = missions.filter((m) => m.completed).length;

  const [heartBeatAnim] = useState(() => new Animated.Value(1));

  // Latido del icono sincronizado con los LPM reales
  useEffect(() => {
    if (vitals.heartRate && vitals.heartRate > 0) {
      const cycleDuration = Math.max(300, Math.min(2000, Math.round((60 / vitals.heartRate) * 1000)));

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(heartBeatAnim, {
            toValue: 1.28,
            duration: Math.round(cycleDuration * 0.18),
            easing: Easing.out(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(heartBeatAnim, {
            toValue: 1,
            duration: Math.round(cycleDuration * 0.82),
            easing: Easing.in(Easing.quad),
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [vitals.heartRate, heartBeatAnim]);

  const handleOpenMetricHistory = async (metric: HistoryMetric) => {
    const reqId = ++historyReqIdRef.current;
    setSelectedMetric(metric);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistorySamples([]);

    try {
      const full = await getFullHistory(metric);
      if (reqId !== historyReqIdRef.current) return;
      const fallback = {
        heart_rate: vitals.pulseHistory,
        spo2: vitals.spo2History,
        stress: vitals.stressHistory,
        sleep: vitals.sleepHistory,
      }[metric];
      setHistorySamples(full.length > 0 ? full : fallback || []);
    } finally {
      if (reqId === historyReqIdRef.current) {
        setHistoryLoading(false);
      }
    }
  };

  // Comando de voz: abre el historial de la métrica pedida (se consume una sola vez)
  const { vitalsIntent, consumeVitalsIntent } = useVoice();
  useEffect(() => {
    if (!vitalsIntent) return;
    consumeVitalsIntent(vitalsIntent.nonce);
    void handleOpenMetricHistory(vitalsIntent.metric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitalsIntent, consumeVitalsIntent]);

  return (
    <View className="px-5 pb-10 pt-6">
      {/* Cabecera del Paciente */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-mono text-xl font-bold text-trauma-ink dark:text-trauma-nightInk">Eliel Alfonso</Text>
        <Pressable
          onPress={() => router.navigate('/missions')}
          className="flex-row items-center rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 active:opacity-75">
          <Flame size={13} color="#f97316" fill="#fb923c" />
          <Text className="ml-1 font-mono text-[10.5px] font-bold text-amber-800 dark:text-amber-200">
            {t('vital.streak.days', { count: streakDays })}
          </Text>
        </Pressable>
      </View>

      {/* Selector de entorno */}
      <View className="mb-4">
        <EnvironmentSelector compact />
      </View>

      {/* Tarjeta interactiva de pulso y ECG */}
      <Pressable
        onPress={() => handleOpenMetricHistory('heart_rate')}
        accessibilityLabel={t('vital.pulse.a11yHistory')}
        className="mb-5 rounded-2xl border border-trauma-line dark:border-trauma-nightLine bg-white dark:bg-trauma-night p-4 shadow-md active:opacity-90">
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-end">
            <Animated.View
              style={{
                transform: [{ scale: vitals.isAvailable ? heartBeatAnim : 1 }],
                marginRight: 8,
                marginBottom: 6,
              }}>
              <Heart
                size={20}
                color={vitals.isAvailable ? '#ef4444' : colors.textSubtle}
                fill={vitals.isAvailable ? '#ef4444' : '#cbd5e1'}
              />
            </Animated.View>

            {vitals.isAvailable && vitals.heartRate !== null ? (
              <>
                <Text className="font-mono text-4xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
                  {vitals.heartRate}
                </Text>
                <Text className="mb-1 ml-1 font-mono text-[10px] text-trauma-ink dark:text-trauma-nightInk dark:text-trauma-nightInk">{t('vital.unit.bpm')}</Text>
              </>
            ) : (
              <View className="mb-1">
                <Text className="font-mono text-xl font-bold text-slate-400 dark:text-trauma-nightSubtle">
                  {t('vital.pulse.unavailable')}
                </Text>
              </View>
            )}
          </View>

          <View className="items-end">
            <View className="flex-row items-center">
              <Activity size={12} color={vitals.isAvailable ? colors.accentDeep : colors.textSubtle} />
              <Text
                className={`ml-1 font-mono text-[9.5px] font-bold ${vitals.isAvailable ? 'text-trauma-cyan' : 'text-slate-400 dark:text-trauma-nightSubtle'
                  }`}>
                {vitals.isAvailable ? t('vital.pulse.live') : t('vital.pulse.noSignal')}
              </Text>
              <ChevronRight size={13} color={colors.textSubtle} />
            </View>

            <Text className="mt-0.5 font-mono text-[8px] text-slate-400 dark:text-trauma-nightSubtle">
              {vitals.lastMeasuredAt
                ? t('vital.pulse.last', { time: localizeLastMeasured(vitals.lastMeasuredAt, t) })
                : t('vital.pulse.tapHistory')}
            </Text>
          </View>
        </View>

        {/* Gráfico animado de ECG coherente con el LPM actual */}
        <RealtimeEcgChart bpm={vitals.heartRate} isAvailable={vitals.isAvailable} />

        <View className="mt-1 flex-row items-center justify-between border-t border-slate-100 dark:border-trauma-nightLine pt-2">
          <Text className="font-mono text-[9px] text-sky-600 dark:text-sky-300 font-bold">
            {t('vital.pulse.tapHere')}
          </Text>
          <ChevronRight size={12} color={colors.accentDeep} />
        </View>
      </Pressable>

      {/* Métricas secundarias: Oxígeno (SpO2) y Estrés */}
      <View className="mb-4 flex-row gap-4">
        <MetricCard
          label={t('vital.tab.spo2')}
          value={vitals.spo2 !== null ? `${vitals.spo2}%` : '--%'}
          percent={vitals.spo2 || 0}
          onPress={() => handleOpenMetricHistory('spo2')}
        />
        <MetricCard
          label={t('vital.metric.stress')}
          value={
            vitals.stress !== null
              ? `${String(vitals.stress).padStart(2, '0')}/100`
              : '--/100'
          }
          percent={vitals.stress || 0}
          onPress={() => handleOpenMetricHistory('stress')}
        />
      </View>

      <SleepSummaryCard
        sleepHours={vitals.sleepHours}
        sleepHistory={vitals.sleepHistory}
        onPress={() => handleOpenMetricHistory('sleep')}
      />

      {/* Resumen de trayectoria y misiones diarias */}
      <Pressable
        onPress={() => router.navigate('/missions')}
        accessibilityLabel={t('vital.missions.a11y')}
        className="mb-5 active:opacity-90">
        <SpaceJourneyTimeline compact />
        <View className="mt-2 flex-row items-center justify-between rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft/60 dark:bg-cyan-950/60 px-3.5 py-2">
          <Text className="font-mono text-[10.5px] font-bold text-trauma-ink dark:text-trauma-nightInk">
            {t('vital.missions.today', { done: completedMissions, total: missions.length })}
          </Text>
          <ChevronRight size={14} color={colors.accentDeep} />
        </View>
      </Pressable>

      {/* Pasos en superficie (Luna/Marte/Tierra) o rutina opcional de caminadora en microgravedad (Nave/EEI) */}
      {environment === 'nave' || environment === 'estacion' ? (
        <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-white dark:bg-trauma-night px-4 py-3 shadow-xs">
          <View className="flex-1 flex-row items-center pr-3">
            <View
              className={`mr-2.5 h-8 w-8 items-center justify-center rounded-xl ${treadmillRoutineActive ? 'bg-sky-50 dark:bg-sky-950' : 'bg-slate-100 dark:bg-trauma-nightAlt'
                }`}>
              <Footprints size={16} color={treadmillRoutineActive ? colors.accentDeep : colors.textMuted} />
            </View>
            <View className="flex-1">
              <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
                {treadmillRoutineActive
                  ? t('vital.treadmill.active')
                  : environment === 'estacion'
                    ? t('vital.treadmill.iss')
                    : t('vital.treadmill.space')}
              </Text>
              <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                {treadmillRoutineActive
                  ? t('vital.treadmill.steps', { steps: formatNumber(vitals.steps, locale) })
                  : t('vital.treadmill.noCount')}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={toggleTreadmillRoutine}
            className={`rounded-xl border px-3 py-1.5 active:opacity-75 ${treadmillRoutineActive
              ? 'border-slate-200 dark:border-trauma-nightLine bg-slate-100 dark:bg-trauma-nightAlt'
              : 'border-trauma-cyanEdge bg-trauma-cyanSoft dark:bg-cyan-950'
              }`}>
            <Text className="font-mono text-[10px] font-bold text-trauma-ink dark:text-trauma-nightInk">
              {treadmillRoutineActive ? t('vital.treadmill.finish') : t('vital.treadmill.start')}
            </Text>
          </Pressable>
        </View>
      ) : (
        vitals.steps > 0 && (
          <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-100 dark:border-trauma-nightLine bg-white dark:bg-trauma-night px-4 py-3 shadow-xs">
            <View className="flex-row items-center">
              <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950">
                <Footprints size={16} color={colors.accentDeep} />
              </View>
              <View>
                <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400 dark:text-trauma-nightSubtle">
                  {t('vital.steps.activity')}
                </Text>
                <Text className="font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                  {t('vital.steps.recorded')}
                </Text>
              </View>
            </View>
            <Text className="font-mono text-base font-extrabold text-slate-900 dark:text-trauma-nightInk">
              {formatNumber(vitals.steps, locale)}
            </Text>
          </View>
        )
      )}

      {/* Reportar molestia → Navegación a Vista Corporal */}
      <View className="items-center mt-3">
        <Pressable
          onPress={() => router.navigate('/explore')}
          accessibilityLabel={t('vital.report.a11y')}
          className="h-20 w-20 items-center justify-center rounded-full border-2 shadow-md active:opacity-70">
          <Image source={require('@/assets/images/App Icono.svg')} style={{ width: 100, height: 100 }} />
        </Pressable>
      </View>

      {/* Modal interactivo con el historial agrupado por día (Pulso, Oxígeno y Estrés) */}
      <VitalHistoryModal
        visible={historyModalOpen}
        metric={selectedMetric}
        onSelectMetric={(m) => void handleOpenMetricHistory(m)}
        onClose={() => setHistoryModalOpen(false)}
        history={historySamples}
        loading={historyLoading}
        currentValue={
          selectedMetric === 'spo2'
            ? vitals.spo2
            : selectedMetric === 'stress'
              ? vitals.stress
              : selectedMetric === 'sleep'
                ? vitals.sleepHours
                : vitals.heartRate
        }
      />
    </View>
  );
}
