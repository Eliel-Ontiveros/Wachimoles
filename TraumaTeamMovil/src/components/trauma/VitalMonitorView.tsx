import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Footprints,
  Heart,
  Activity,
  ChevronRight,
  Droplets,
  TrendingUp,
  History,
  Flame,
  Moon,
  Zap,
} from 'lucide-react-native';
import { DashboardSample } from '../../types/vital-signs';
import { EnvironmentSelector } from './EnvironmentSelector';
import { SpaceJourneyTimeline } from './SpaceJourneyTimeline';
import { useMission } from './mission-context';
import { useVoice } from '@/voice/voice-context';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import type { Locale, MessageKey } from '@/i18n/messages';
import { useAppTheme } from '@/theme';

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

function formatDateTimeShort(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  const date = formatDate(d, locale, { day: '2-digit', month: '2-digit' });
  return `${date} ${formatTime(d, locale)}`;
}

function buildSmoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

const BANNER_STARS = [
  { x: 24, y: 16, r: 1.1, o: 0.6 },
  { x: 78, y: 42, r: 0.9, o: 0.45 },
  { x: 138, y: 14, r: 1.3, o: 0.75 },
  { x: 210, y: 54, r: 1.0, o: 0.5 },
  { x: 295, y: 20, r: 1.2, o: 0.7 },
  { x: 350, y: 48, r: 1.1, o: 0.6 },
  { x: 392, y: 18, r: 1.3, o: 0.78 },
];

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
    nominalMin?: number;
    nominalMax?: number;
    nominalKey?: MessageKey;
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
    nominalMin: 60,
    nominalMax: 100,
    nominalKey: 'vital.nominal.heart_rate',
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
    nominalMin: 95,
    nominalMax: 100,
    nominalKey: 'vital.nominal.spo2',
  },
  stress: {
    titleKey: 'vital.title.stress',
    tabKey: 'vital.tab.stress',
    unitKey: null,
    unit: '/100',
    accent: '#f59e0b',
    softBg: '#fffbeb',
    softBgDark: '#3a2a08',
    minBound: 0,
    maxBound: 100,
    nominalMin: 0,
    nominalMax: 65,
    nominalKey: 'vital.nominal.stress',
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
    nominalMin: 7,
    nominalMax: 9,
    nominalKey: 'vital.nominal.sleep',
  },
};

function renderHistoryTabIcon(metric: HistoryMetric, color: string, size = 12) {
  switch (metric) {
    case 'heart_rate':
      return <Heart size={size} color={color} />;
    case 'spo2':
      return <Droplets size={size} color={color} />;
    case 'stress':
      return <Zap size={size} color={color} />;
    case 'sleep':
      return <Moon size={size} color={color} />;
  }
}

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

// Modal Bitácora de Vuelo: historial agrupado y evolución para Pulso, Oxígeno, Estrés y Sueño
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
  const { height: windowHeight } = useWindowDimensions();
  const dismissDistance = Math.max(760, windowHeight);
  const dismissDistanceRef = useRef(dismissDistance);
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const sheetTranslateY = useRef(new Animated.Value(dismissDistance)).current;
  const scrollYRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const meta = METRIC_META[metric];
  const unitLabel = meta.unitKey ? t(meta.unitKey) : meta.unit;

  useEffect(() => {
    dismissDistanceRef.current = dismissDistance;
  }, [dismissDistance]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setSelectedPointIdx(null);
  }, [metric, visible]);

  useEffect(() => {
    if (!visible) return;
    scrollYRef.current = 0;
    sheetTranslateY.setValue(dismissDistanceRef.current);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [visible, sheetTranslateY]);

  const dismissSheet = () => {
    Animated.timing(sheetTranslateY, {
      toValue: dismissDistanceRef.current,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => {
      onCloseRef.current();
    });
  };

  const backdropOpacity = sheetTranslateY.interpolate({
    inputRange: [0, dismissDistance * 0.75],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const { headerPanResponder, bodyPanResponder } = useMemo(() => {
    const finishDrag = (dy: number, vy: number) => {
      if (dy > 95 || vy > 0.65) {
        Animated.timing(sheetTranslateY, {
          toValue: dismissDistanceRef.current,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(() => {
          onCloseRef.current();
        });
      } else {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          bounciness: 5,
          speed: 18,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start();
      }
    };

    const sharedCallbacks = {
      onPanResponderMove: (_: unknown, gs: { dy: number }) => {
        if (gs.dy > 0) {
          sheetTranslateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_: unknown, gs: { dy: number; vy: number }) =>
        finishDrag(gs.dy, gs.vy),
      onPanResponderTerminate: (_: unknown, gs: { dy: number; vy: number }) =>
        finishDrag(gs.dy, gs.vy),
    };

    return {
      headerPanResponder: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
        ...sharedCallbacks,
      }),
      bodyPanResponder: PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gs) =>
          scrollYRef.current <= 1 && gs.dy > 10 && gs.dy > Math.abs(gs.dx),
        ...sharedCallbacks,
      }),
    };
  }, [sheetTranslateY]);

  const validSamples = useMemo(() => {
    return history.filter((s) => s.metric === metric && Number(s.value) > 0);
  }, [history, metric]);

  const metricSeries = useMemo(() => {
    const sorted = validSamples
      .slice()
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
    return sorted.length > 30 ? sorted.slice(sorted.length - 30) : sorted;
  }, [validSamples]);

  const dailySummaries = useMemo(
    () => groupSamplesByDay(validSamples, locale, t),
    [validSamples, locale, t]
  );

  const stats = useMemo(() => {
    if (metricSeries.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        latest: currentValue || 0,
        latestTime: null as string | null,
        count: 0,
      };
    }
    const vals = metricSeries.map((s) =>
      metric === 'sleep' ? s.value : Math.round(s.value)
    );
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sum = vals.reduce((acc, v) => acc + v, 0);
    const avg =
      metric === 'sleep'
        ? Math.round((sum / vals.length) * 10) / 10
        : Math.round(sum / vals.length);
    const latestSample = metricSeries[metricSeries.length - 1];
    const latest = currentValue ?? vals[vals.length - 1];
    return {
      min,
      max,
      avg,
      latest,
      latestTime: latestSample?.measuredAt ?? null,
      count: metricSeries.length,
    };
  }, [metric, metricSeries, currentValue]);

  const chartGeometry = useMemo(() => {
    const height = 148;
    const padLeft = 32;
    const padRight = 12;
    const padTop = 14;
    const padBottom = 16;
    const width = Math.max(0, chartWidth);
    const innerW = Math.max(1, width - padLeft - padRight);
    const innerH = height - padTop - padBottom;

    if (width <= 0 || metricSeries.length === 0) {
      return {
        width,
        height,
        padLeft,
        padRight,
        padTop,
        padBottom,
        innerW,
        innerH,
        minVal: 0,
        maxVal: 100,
        points: [] as { sample: DashboardSample; x: number; y: number }[],
        linePathD: '',
        areaPathD: '',
        nominalMinY: null as number | null,
        nominalMaxY: null as number | null,
      };
    }

    let minVal = Math.min(...metricSeries.map((p) => p.value));
    let maxVal = Math.max(...metricSeries.map((p) => p.value));
    if (meta.nominalMin !== undefined) minVal = Math.min(minVal, meta.nominalMin);
    if (meta.nominalMax !== undefined) maxVal = Math.max(maxVal, meta.nominalMax);

    if (minVal === maxVal) {
      minVal = Math.max(meta.minBound, minVal - 5);
      maxVal = Math.min(meta.maxBound, maxVal + 5);
    } else {
      const span = maxVal - minVal;
      minVal = Math.max(meta.minBound, minVal - span * 0.12);
      maxVal = Math.min(meta.maxBound, maxVal + span * 0.12);
    }

    const span = Math.max(0.001, maxVal - minVal);
    const points = metricSeries.map((sample, idx) => {
      const rx = metricSeries.length === 1 ? 0.5 : idx / (metricSeries.length - 1);
      const ry = (sample.value - minVal) / span;
      return {
        sample,
        x: padLeft + rx * innerW,
        y: padTop + innerH - ry * innerH,
      };
    });

    const linePathD = buildSmoothCurvePath(points);
    let areaPathD = '';
    if (points.length >= 2 && linePathD) {
      const baseY = padTop + innerH;
      const first = points[0];
      const last = points[points.length - 1];
      areaPathD = `${linePathD} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
    }

    const toY = (v?: number) => {
      if (v === undefined) return null;
      const y = padTop + innerH - ((v - minVal) / span) * innerH;
      return y >= padTop && y <= padTop + innerH ? y : null;
    };

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      innerW,
      innerH,
      minVal,
      maxVal,
      points,
      linePathD,
      areaPathD,
      nominalMinY: toY(meta.nominalMin),
      nominalMaxY: toY(meta.nominalMax),
    };
  }, [chartWidth, metricSeries, meta]);

  const activePoint =
    selectedPointIdx !== null && chartGeometry.points[selectedPointIdx]
      ? chartGeometry.points[selectedPointIdx]
      : chartGeometry.points[chartGeometry.points.length - 1] ?? null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissSheet}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(5, 11, 25, 0.58)',
            opacity: backdropOpacity,
          }}
        />
        <Pressable
          onPress={dismissSheet}
          accessibilityLabel={t('vital.history.close')}
          style={{ flex: 1 }}
        />
        <Animated.View
          {...bodyPanResponder.panHandlers}
          style={{
            height: '86%',
            transform: [{ translateY: sheetTranslateY }],
          }}>
          <View
            style={{ flex: 1 }}
            className="overflow-hidden rounded-t-3xl bg-[#f8fafc] shadow-2xl dark:bg-trauma-nightBg">
            {/* Banner espacial superior arrastrable hacia abajo para cerrar */}
            <View
              {...headerPanResponder.panHandlers}
              style={{ backgroundColor: '#060b19', position: 'relative' }}>
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 420 96"
                preserveAspectRatio="xMidYMid slice"
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
                <Defs>
                  <LinearGradient id="mobileHistorySky" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#060b19" />
                    <Stop offset="100%" stopColor="#0b1633" />
                  </LinearGradient>
                  <RadialGradient id="mobileEarth" cx="35%" cy="30%" r="65%">
                    <Stop offset="0%" stopColor="#38bdf8" />
                    <Stop offset="100%" stopColor="#0369a1" />
                  </RadialGradient>
                  <RadialGradient id="mobileMoon" cx="35%" cy="30%" r="65%">
                    <Stop offset="0%" stopColor="#f1f5f9" />
                    <Stop offset="100%" stopColor="#94a3b8" />
                  </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={420} height={96} fill="url(#mobileHistorySky)" />
                {BANNER_STARS.map((st, idx) => (
                  <Circle key={idx} cx={st.x} cy={st.y} r={st.r} fill="#e0f2fe" opacity={st.o} />
                ))}
                <Path
                  d="M 226 68 Q 312 18 390 54"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1.3}
                  strokeDasharray="4 4"
                  opacity={0.5}
                />
                <Circle cx={226} cy={68} r={9} fill="url(#mobileEarth)" opacity={0.92} />
                <Circle cx={390} cy={54} r={7.5} fill="url(#mobileMoon)" opacity={0.92} />
                <Circle cx={312} cy={38} r={4} fill="#7dd3fc" opacity={0.9} />
                <Circle cx={312} cy={38} r={9} fill="rgba(125,211,252,0.18)" />
              </Svg>

              <View className="px-5 pb-3.5 pt-2.5">
                <View className="mx-auto mb-2.5 h-1 w-12 rounded-full bg-white/35" />
                <View>
                  <Text className="font-mono text-[9px] font-bold uppercase tracking-[1.6px] text-sky-300">
                    {t('vital.logbook.kicker')}
                  </Text>
                  <Text className="mt-0.5 font-mono text-lg font-extrabold text-white">
                    {t(meta.titleKey)}
                  </Text>
                  <Text className="mt-0.5 font-mono text-[10px] text-slate-300">
                    {stats.count > 0 && stats.latestTime
                      ? t('vital.logbook.summary', {
                          count: stats.count,
                          time: formatDateTimeShort(stats.latestTime, locale),
                        })
                      : t('vital.logbook.noReadings')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pestañas oscuras estilo Web para alternar entre métricas */}
            <View className="border-b border-slate-200/80 bg-white px-4 py-2.5 dark:bg-trauma-night dark:border-trauma-nightLine">
              <View className="flex-row gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-trauma-nightAlt">
                {(['heart_rate', 'spo2', 'stress', 'sleep'] as HistoryMetric[]).map((mKey) => {
                  const active = mKey === metric;
                  const tabMeta = METRIC_META[mKey];
                  return (
                    <Pressable
                      key={mKey}
                      onPress={() => onSelectMetric(mKey)}
                      style={
                        active
                          ? {
                            backgroundColor: '#060b19',
                            shadowColor: '#020617',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.16,
                            shadowRadius: 4,
                            elevation: 2,
                          }
                          : undefined
                      }
                      className="flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2">
                      {renderHistoryTabIcon(
                        mKey,
                        active ? tabMeta.accent : colors.textMuted,
                        12
                      )}
                      <Text
                        numberOfLines={1}
                        style={{ color: active ? tabMeta.accent : colors.textMuted }}
                        className="font-mono text-[10px] font-bold">
                        {t(tabMeta.tabKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <ScrollView
              className="flex-1 px-4 pt-3.5"
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollYRef.current = e.nativeEvent.contentOffset.y;
              }}>
              {loading ? (
                <HistorySkeleton />
              ) : (
                <>
                  {/* Estadísticas clave */}
                  {metric === 'sleep' ? (
                    <View className="flex-row justify-between gap-2.5">
                      <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-[9.5px] font-semibold text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.stat.current')}
                        </Text>
                        <Text
                          style={{ color: meta.accent }}
                          className="mt-0.5 font-mono text-lg font-extrabold">
                          {stats.latest ? `${formatMetricValue(metric, stats.latest)} ${unitLabel}` : '--'}
                        </Text>
                      </View>

                      <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-[9.5px] font-semibold text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.stat.max')}
                        </Text>
                        <Text className="mt-0.5 font-mono text-lg font-extrabold text-slate-900 dark:text-trauma-nightInk">
                          {stats.max ? `${formatMetricValue(metric, stats.max)} ${unitLabel}` : '--'}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View className="flex-row justify-between gap-2">
                      <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-[9.5px] font-semibold text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.stat.lastReading')}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ color: meta.accent }}
                          className="mt-0.5 font-mono text-base font-extrabold">
                          {stats.latest ? `${formatMetricValue(metric, stats.latest)} ${unitLabel}` : '--'}
                        </Text>
                      </View>

                      <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-[9.5px] font-semibold text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.stat.average')}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="mt-0.5 font-mono text-base font-extrabold text-sky-600 dark:text-sky-300">
                          {stats.avg ? `${formatMetricValue(metric, stats.avg)} ${unitLabel}` : '--'}
                        </Text>
                      </View>

                      <View className="flex-1 rounded-2xl border border-slate-200/80 bg-white p-3 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-[9.5px] font-semibold text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.stat.minMaxDash')}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="mt-1 font-mono text-xs font-extrabold text-slate-900 dark:text-trauma-nightInk">
                          {stats.min && stats.max
                            ? `${formatMetricValue(metric, stats.min)}–${formatMetricValue(metric, stats.max)} ${unitLabel}`
                            : '--'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Gráfica: barras por día para sueño, curva suavizada interactiva para el resto */}
                  {metric === 'sleep' ? (
                    dailySummaries.length > 0 && (
                      <View className="mt-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:bg-trauma-night dark:border-trauma-nightLine">
                        <View className="mb-3 flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <TrendingUp size={13} color={meta.accent} />
                            <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                              {t('vital.sleep.hoursPerDay')}
                            </Text>
                          </View>
                          <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                            {t('vital.sleep.goalShort')}
                          </Text>
                        </View>

                        <View className="flex-row items-end justify-between gap-2 pt-1">
                          {dailySummaries
                            .slice(0, 10)
                            .reverse()
                            .map((day) => {
                              const scaleMax = Math.max(10, stats.max ?? 10);
                              const barPct = Math.max(
                                12,
                                Math.min(100, Math.round((day.max / scaleMax) * 100))
                              );
                              const barColor =
                                day.max < 5.5
                                  ? '#dc2626'
                                  : day.max < 7
                                    ? '#d97706'
                                    : '#059669';
                              return (
                                <View key={day.dateKey} className="flex-1 items-center">
                                  <Text className="mb-1 font-mono text-[8.5px] font-bold text-slate-700 dark:text-trauma-nightInk">
                                    {day.max.toFixed(1)}h
                                  </Text>
                                  <View className="h-24 w-full max-w-[24px] justify-end overflow-hidden rounded-md bg-slate-100 dark:bg-trauma-nightAlt">
                                    <View
                                      style={{
                                        height: `${barPct}%`,
                                        backgroundColor: barColor,
                                        borderTopLeftRadius: 5,
                                        borderTopRightRadius: 5,
                                      }}
                                    />
                                  </View>
                                  <Text
                                    numberOfLines={1}
                                    className="mt-1.5 font-mono text-[8.5px] text-slate-500 dark:text-trauma-nightMuted">
                                    {getSleepShortDayLabel(day, t)}
                                  </Text>
                                </View>
                              );
                            })}
                        </View>
                      </View>
                    )
                  ) : (
                    <View className="mt-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:bg-trauma-night dark:border-trauma-nightLine">
                      <View className="mb-2.5 flex-row items-center justify-between gap-2">
                        <View className="flex-row items-center">
                          <TrendingUp size={13} color={meta.accent} />
                          <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800 dark:text-trauma-nightInk">
                            {t('vital.trend.recent')}
                          </Text>
                        </View>

                        {activePoint && (
                          <View
                            style={{ borderColor: meta.accent, borderWidth: 1, backgroundColor: scheme === 'dark' ? meta.softBgDark : meta.softBg }}
                            className="flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5">
                            <Text style={{ color: meta.accent }} className="font-mono text-[10px] font-extrabold">
                              {formatMetricValue(metric, activePoint.sample.value)} {unitLabel}
                            </Text>
                            <Text className="font-mono text-[9px] text-slate-500 dark:text-trauma-nightMuted">
                              {formatDateTimeShort(activePoint.sample.measuredAt, locale)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {metricSeries.length === 0 ? (
                        <View className="items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-7 dark:bg-trauma-nightAlt dark:border-trauma-nightLine">
                          <Activity size={16} color={colors.textSubtle} />
                          <Text className="mt-1.5 font-mono text-[11px] text-slate-400 dark:text-trauma-nightSubtle">
                            {t('vital.trend.noReadings', { metric: t(meta.tabKey).toLowerCase() })}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <View
                            style={{ height: chartGeometry.height, width: '100%' }}
                            onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                            {chartGeometry.width > 0 && chartGeometry.points.length > 0 && (
                              <Svg width={chartGeometry.width} height={chartGeometry.height}>
                                <Defs>
                                  <LinearGradient id={`histArea-${metric}`} x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0%" stopColor={meta.accent} stopOpacity="0.26" />
                                    <Stop offset="100%" stopColor={meta.accent} stopOpacity="0.01" />
                                  </LinearGradient>
                                </Defs>

                                {[0, 0.5, 1].map((frac, idx) => {
                                  const y = chartGeometry.padTop + frac * chartGeometry.innerH;
                                  const val =
                                    chartGeometry.maxVal -
                                    frac * (chartGeometry.maxVal - chartGeometry.minVal);
                                  return (
                                    <Fragment key={idx}>
                                      <Line
                                        x1={chartGeometry.padLeft}
                                        y1={y}
                                        x2={chartGeometry.width - chartGeometry.padRight}
                                        y2={y}
                                        stroke={scheme === 'dark' ? colors.border : '#e2e8f0'}
                                        strokeWidth={1}
                                        strokeDasharray="3 4"
                                      />
                                      <SvgText
                                        x={chartGeometry.padLeft - 5}
                                        y={y + 3}
                                        textAnchor="end"
                                        fill={colors.textSubtle}
                                        fontSize="9">
                                        {formatMetricValue(metric, val)}
                                      </SvgText>
                                    </Fragment>
                                  );
                                })}

                                {chartGeometry.nominalMinY !== null && (
                                  <Line
                                    x1={chartGeometry.padLeft}
                                    y1={chartGeometry.nominalMinY}
                                    x2={chartGeometry.width - chartGeometry.padRight}
                                    y2={chartGeometry.nominalMinY}
                                    stroke="#38bdf8"
                                    strokeWidth={1.2}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.75}
                                  />
                                )}

                                {chartGeometry.nominalMaxY !== null && (
                                  <Line
                                    x1={chartGeometry.padLeft}
                                    y1={chartGeometry.nominalMaxY}
                                    x2={chartGeometry.width - chartGeometry.padRight}
                                    y2={chartGeometry.nominalMaxY}
                                    stroke="#38bdf8"
                                    strokeWidth={1.2}
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.75}
                                  />
                                )}

                                {chartGeometry.areaPathD !== '' && (
                                  <Path d={chartGeometry.areaPathD} fill={`url(#histArea-${metric})`} />
                                )}

                                {chartGeometry.linePathD !== '' && (
                                  <Path
                                    d={chartGeometry.linePathD}
                                    fill="none"
                                    stroke={meta.accent}
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {chartGeometry.points.map((pt, idx) => {
                                  const isActive =
                                    activePoint?.sample.sampleId === pt.sample.sampleId &&
                                    activePoint?.sample.measuredAt === pt.sample.measuredAt;
                                  return (
                                    <Fragment key={`${pt.sample.id}-${idx}`}>
                                      <Circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={isActive ? 4.6 : 2.3}
                                        fill={isActive ? colors.surface : meta.accent}
                                        stroke={meta.accent}
                                        strokeWidth={isActive ? 2.2 : 1}
                                      />
                                      <Circle
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={12}
                                        fill="transparent"
                                        onPress={() => setSelectedPointIdx(idx)}
                                      />
                                    </Fragment>
                                  );
                                })}
                              </Svg>
                            )}
                          </View>

                          <View className="mt-1 flex-row items-center justify-between border-t border-slate-100 pt-2 dark:border-trauma-nightLine">
                            <View className="flex-row items-center">
                              <View
                                style={{ backgroundColor: '#38bdf8' }}
                                className="mr-1.5 h-1.5 w-3 rounded-full opacity-75"
                              />
                              <Text className="font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                                {meta.nominalKey ? t(meta.nominalKey) : ''}
                              </Text>
                            </View>
                            <Text className="font-mono text-[8.5px] text-slate-400 dark:text-trauma-nightSubtle">
                              {t('vital.trend.tapPoint')}
                            </Text>
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  {/* Resumen por jornada estilo Web */}
                  <View className="mt-4 pb-10">
                    <View className="mb-2.5 flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <History size={13} color="#64748b" />
                        <Text className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-trauma-nightInk">
                          {t('vital.daily.summaryTitle')}
                        </Text>
                      </View>
                      <Text className="font-mono text-[9.5px] text-slate-400 dark:text-trauma-nightSubtle">
                        {dailySummaries.length}{' '}
                        {t(dailySummaries.length === 1 ? 'vital.daily.day' : 'vital.daily.days')}
                      </Text>
                    </View>

                    {dailySummaries.length === 0 ? (
                      <View className="items-center rounded-2xl border border-slate-200/80 bg-white p-6 dark:bg-trauma-night dark:border-trauma-nightLine">
                        <Text className="font-mono text-xs text-slate-400 dark:text-trauma-nightSubtle">
                          {t('vital.daily.empty', { metric: t(meta.tabKey).toLowerCase() })}
                        </Text>
                      </View>
                    ) : (
                      dailySummaries.map((day) => {
                        const spread = day.max - day.min;
                        const avgPct =
                          spread <= 0
                            ? 50
                            : Math.min(
                              96,
                              Math.max(4, Math.round(((day.avg - day.min) / spread) * 100))
                            );

                        return (
                          <View
                            key={day.dateKey}
                            className="mb-2.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:bg-trauma-night dark:border-trauma-nightLine">
                            <View className="mb-2.5 flex-row items-center justify-between">
                              <View>
                                <Text className="font-mono text-xs font-extrabold text-slate-800 dark:text-trauma-nightInk">
                                  {day.dateLabel}
                                </Text>
                                <Text className="mt-0.5 font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
                                  {day.count}{' '}
                                  {metric === 'sleep'
                                    ? t(day.count === 1 ? 'vital.count.record' : 'vital.count.records')
                                    : t(day.count === 1 ? 'vital.count.reading' : 'vital.count.readings')}
                                </Text>
                              </View>

                              <View
                                style={{ backgroundColor: scheme === 'dark' ? meta.softBgDark : meta.softBg }}
                                className="rounded-full px-2.5 py-1">
                                <Text
                                  style={{ color: meta.accent }}
                                  className="font-mono text-[10px] font-extrabold">
                                  {t('vital.daily.avgShort', { value: formatMetricValue(metric, day.avg), unit: unitLabel })}
                                </Text>
                              </View>
                            </View>

                            {metric === 'sleep' ? (
                              <View className="flex-row items-center justify-between rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 dark:bg-violet-950 dark:border-violet-900">
                                <Text className="font-mono text-xs font-bold text-violet-800 dark:text-violet-200">
                                  {t('vital.sleep.restRecorded')}
                                </Text>
                                <Text className="font-mono text-base font-extrabold text-violet-800 dark:text-violet-200">
                                  {formatMetricValue(metric, day.max)} h
                                </Text>
                              </View>
                            ) : (
                              <View>
                                <View className="mb-1.5 flex-row items-center justify-between">
                                  <Text className="font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted">
                                    {t('vital.daily.min')}{' '}
                                    <Text className="font-bold text-slate-800 dark:text-trauma-nightInk">
                                      {formatMetricValue(metric, day.min)}
                                    </Text>{' '}
                                    ({day.minTime})
                                  </Text>
                                  <Text className="font-mono text-[9.5px] text-slate-500 dark:text-trauma-nightMuted">
                                    {t('vital.daily.max')}{' '}
                                    <Text className="font-bold text-slate-800 dark:text-trauma-nightInk">
                                      {formatMetricValue(metric, day.max)}
                                    </Text>{' '}
                                    ({day.maxTime})
                                  </Text>
                                </View>

                                <View className="relative h-2 w-full justify-center rounded-full bg-slate-100 dark:bg-trauma-nightAlt">
                                  <View
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      right: 0,
                                      top: 0,
                                      bottom: 0,
                                      borderRadius: 999,
                                      backgroundColor: meta.accent,
                                      opacity: 0.25,
                                    }}
                                  />
                                  <View
                                    style={{
                                      position: 'absolute',
                                      left: `${avgPct}%`,
                                      marginLeft: -5.5,
                                      width: 11,
                                      height: 11,
                                      borderRadius: 999,
                                      backgroundColor: colors.surface,
                                      borderWidth: 2.5,
                                      borderColor: meta.accent,
                                      shadowColor: '#0f172a',
                                      shadowOffset: { width: 0, height: 1 },
                                      shadowOpacity: 0.2,
                                      shadowRadius: 2,
                                      elevation: 2,
                                    }}
                                  />
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
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

function SleepSummaryCard({
  sleepHours,
  onPress,
}: {
  sleepHours: number | null;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const progressPct =
    sleepHours !== null ? Math.max(0, Math.min(100, Math.round((sleepHours / 7) * 100))) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t('vital.sleep.a11yHistory')}
      className="mb-4 rounded-2xl border border-trauma-line bg-white p-4 shadow-md active:opacity-85 dark:bg-trauma-night dark:border-trauma-nightLine">
      {/* Cabecera simple: nombre y > */}
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-xs font-bold text-trauma-ink dark:text-trauma-nightInk">
          {t('vital.sleep.cardTitle')}
        </Text>
        <ChevronRight size={14} color={colors.textSubtle} />
      </View>

      {/* Horas dormidas anoche */}
      <View className="mt-2.5 flex-row items-end justify-between gap-2">
        <View>
          <View className="flex-row items-baseline">
            <Text className="font-mono text-3xl font-extrabold text-trauma-ink dark:text-trauma-nightInk">
              {sleepHours !== null ? sleepHours.toFixed(1) : '--'}
            </Text>
            <Text className="ml-1 font-mono text-xs font-bold text-trauma-muted dark:text-trauma-nightMuted">h</Text>
            {sleepHours !== null && (
              <Text className="ml-2 font-mono text-[10px] font-semibold text-slate-500 dark:text-trauma-nightMuted">
                ({formatSleepDuration(sleepHours)})
              </Text>
            )}
          </View>
          <Text className="mt-0.5 font-mono text-[9px] text-slate-400 dark:text-trauma-nightSubtle">
            {sleepHours !== null ? t('vital.sleep.slept') : t('vital.sleep.noRecorded')}
          </Text>
        </View>

        {sleepHours !== null && (
          <Text className="font-mono text-[9.5px] font-bold text-sky-600 dark:text-sky-300">
            {t('vital.sleep.progress', { pct: progressPct })}
          </Text>
        )}
      </View>

      {/* Barra de progreso con el mismo azul cian que las demás tarjetas */}
      <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-trauma-nightLine">
        <View
          className="h-full rounded-full bg-trauma-cyan"
          style={{ width: `${progressPct}%` }}
        />
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
