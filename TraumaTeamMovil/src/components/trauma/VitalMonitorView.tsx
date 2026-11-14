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
                stroke="#f1f5f9"
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
                stroke="#f1f5f9"
                strokeWidth={0.7}
              />
            ))}
            {/* Línea guía central */}
            <Line
              x1={0}
              y1={h / 2}
              x2={containerWidth}
              y2={h / 2}
              stroke="#e2e8f0"
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
                stroke={isAvailable ? '#0284c7' : '#94a3b8'}
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
  count: number;
  avg: number;
  max: number;
  maxTime: string;
  min: number;
  minTime: string;
}

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function formatHourMinute(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;

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

  const shortDate = `${d} ${MONTHS_ES[m - 1] ?? ''}`;
  if (dateKey === todayKey) return `Hoy · ${shortDate}`;
  if (dateKey === yesterdayKey) return `Ayer · ${shortDate}`;
  return `${shortDate} ${y}`;
}

function groupSamplesByDay(samples: DashboardSample[]): DailySummary[] {
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

    summaries.push({
      dateKey,
      dateLabel: formatDayLabel(dateKey),
      count: list.length,
      avg: isSleep
        ? Math.round((sum / list.length) * 10) / 10
        : Math.round(sum / list.length),
      max: isSleep ? maxSample.value : Math.round(maxSample.value),
      maxTime: formatHourMinute(maxSample.measuredAt),
      min: isSleep ? minSample.value : Math.round(minSample.value),
      minTime: formatHourMinute(minSample.measuredAt),
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
    title: string;
    tabLabel: string;
    unit: string;
    accent: string;
    softBg: string;
    minBound: number;
    maxBound: number;
  }
> = {
  heart_rate: {
    title: 'Historial de Pulso',
    tabLabel: 'Pulso',
    unit: 'Lpm',
    accent: '#ef4444',
    softBg: '#fef2f2',
    minBound: 30,
    maxBound: 220,
  },
  spo2: {
    title: 'Historial de Oxígeno',
    tabLabel: 'Oxígeno',
    unit: '%',
    accent: '#0284c7',
    softBg: '#f0f9ff',
    minBound: 70,
    maxBound: 100,
  },
  stress: {
    title: 'Historial de Estrés',
    tabLabel: 'Estrés',
    unit: '/100',
    accent: '#f97316',
    softBg: '#fff7ed',
    minBound: 0,
    maxBound: 100,
  },
  sleep: {
    title: 'Historial de Sueño',
    tabLabel: 'Sueño',
    unit: 'h',
    accent: '#7c3aed',
    softBg: '#f5f3ff',
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
            className="h-20 flex-1 rounded-2xl border border-slate-100 bg-slate-100/80 p-3"
          />
        ))}
      </View>

      <View className="mt-3.5 h-32 rounded-2xl border border-slate-100 bg-slate-100/80 p-3.5" />

      <View className="mt-4 gap-3 pb-10">
        {[0, 1].map((i) => (
          <View
            key={i}
            className="h-28 rounded-2xl border border-slate-100 bg-slate-100/80 p-3.5"
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
  const [chartWidth, setChartWidth] = useState(0);
  const meta = METRIC_META[metric];

  const validSamples = useMemo(() => {
    return history.filter((s) => s.metric === metric && Number(s.value) > 0);
  }, [history, metric]);

  const dailySummaries = useMemo(() => groupSamplesByDay(validSamples), [validSamples]);

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
          backgroundColor: 'rgba(15,23,42,0.45)',
          justifyContent: 'flex-end',
        }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ height: '82%' }}>
          <View
            style={{ flex: 1 }}
            className="overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl">
            <View className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" />

            {/* Cabecera del modal */}
            <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-3">
              <View className="flex-row items-center">
                <View
                  style={{ backgroundColor: meta.softBg }}
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
                  <Text className="font-mono text-base font-extrabold text-slate-900">
                    {meta.title}
                  </Text>
                  <Text className="font-mono text-[10px] text-slate-400">
                    {metric === 'sleep'
                      ? 'Duración de sueño registrada por noche'
                      : 'Resumen agrupado por día (pico, promedio y mínimo)'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <X size={16} color="#475569" />
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
                      ? 'border-trauma-cyanEdge bg-trauma-cyanSoft'
                      : 'border-slate-200 bg-[#f8fafc]'
                      }`}>
                    <Text
                      className={`font-mono text-[10.5px] font-bold ${active ? 'text-trauma-ink' : 'text-slate-500'
                        }`}>
                      {METRIC_META[mKey].tabLabel}
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
                    <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-[#f8fafc] p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400">Actual</Text>
                      <Text className="font-mono text-lg font-extrabold text-slate-900">
                        {stats.latest ? formatMetricValue(metric, stats.latest) : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500">{meta.unit}</Text>
                    </View>

                    <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-[#f8fafc] p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400">Promedio</Text>
                      <Text className="font-mono text-lg font-extrabold text-sky-600">
                        {stats.avg ? formatMetricValue(metric, stats.avg) : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500">{meta.unit}</Text>
                    </View>

                    <View className="flex-1 items-center rounded-2xl border border-slate-100 bg-[#f8fafc] p-3">
                      <Text className="font-mono text-[9px] uppercase text-slate-400">Mín / Máx</Text>
                      <Text className="mt-0.5 font-mono text-sm font-extrabold text-slate-900">
                        {stats.min && stats.max
                          ? `${formatMetricValue(metric, stats.min)} - ${formatMetricValue(metric, stats.max)}`
                          : '--'}
                      </Text>
                      <Text className="font-mono text-[8.5px] text-slate-500">Rango</Text>
                    </View>
                  </View>

                  {/* Gráfica de tendencia */}
                  {validSamples.length >= 2 && (
                    <View className="mt-3.5 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-xs">
                      <View className="mb-2 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <TrendingUp size={13} color={meta.accent} />
                          <Text className="ml-1.5 font-mono text-xs font-bold text-slate-800">
                            Tendencia reciente
                          </Text>
                        </View>
                        <Text className="font-mono text-[9.5px] text-slate-400">
                          Últimas {Math.min(18, validSamples.length)} lecturas
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
                            <Line x1={0} y1={22} x2={chartWidth} y2={22} stroke="#f1f5f9" strokeWidth={1} />
                            <Line x1={0} y1={50} x2={chartWidth} y2={50} stroke="#f1f5f9" strokeWidth={1} />
                            <Line x1={0} y1={78} x2={chartWidth} y2={78} stroke="#f1f5f9" strokeWidth={1} />

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
                      <History size={13} color="#64748b" />
                      <Text className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Resumen por día ({dailySummaries.length} días)
                      </Text>
                    </View>

                    {dailySummaries.length === 0 ? (
                      <View className="items-center rounded-2xl border border-slate-100 bg-[#f8fafc] p-6">
                        <Text className="font-mono text-xs text-slate-400">
                          No hay registros de {meta.tabLabel.toLowerCase()} guardados aún.
                        </Text>
                      </View>
                    ) : (
                      dailySummaries.map((day) => (
                        <View
                          key={day.dateKey}
                          className="mb-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
                          <View className="mb-2.5 flex-row items-center justify-between border-b border-slate-100 pb-2">
                            <Text className="font-mono text-xs font-extrabold text-slate-800">
                              {day.dateLabel}
                            </Text>
                            <View className="rounded-md bg-slate-100 px-2 py-0.5">
                              <Text className="font-mono text-[9px] font-bold text-slate-500">
                                {day.count} {metric === 'sleep'
                                  ? day.count === 1 ? 'registro' : 'registros'
                                  : day.count === 1 ? 'lectura' : 'lecturas'}
                              </Text>
                            </View>
                          </View>

                          {metric === 'sleep' ? (
                            <View className="flex-row items-center justify-between rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                              <View className="flex-row items-center">
                                <Moon size={16} color="#7c3aed" />
                                <Text className="ml-2 font-mono text-xs font-bold text-violet-800">
                                  Duración total
                                </Text>
                              </View>
                              <Text className="font-mono text-lg font-extrabold text-violet-800">
                                {formatMetricValue(metric, day.max)} h
                              </Text>
                            </View>
                          ) : (
                            <View className="flex-row gap-2">
                              <View className="flex-1 rounded-xl border border-red-100 bg-red-50/40 p-2.5">
                                <View className="flex-row items-center">
                                  <ArrowUpRight size={12} color="#dc2626" />
                                  <Text className="ml-0.5 font-mono text-[8.5px] font-bold uppercase text-red-600">
                                    Pico más alto
                                  </Text>
                                </View>
                                <Text className="mt-1 font-mono text-sm font-extrabold text-slate-900">
                                  {formatMetricValue(metric, day.max)} <Text className="text-[9px] font-normal text-slate-500">{meta.unit}</Text>
                                </Text>
                                <View className="mt-1 flex-row items-center">
                                  <Clock size={10} color="#64748b" />
                                  <Text className="ml-1 font-mono text-[9px] text-slate-500">
                                    {day.maxTime}
                                  </Text>
                                </View>
                              </View>

                              <View className="flex-1 items-center justify-center rounded-xl border border-sky-100 bg-sky-50/50 p-2.5">
                                <Text className="font-mono text-[8.5px] font-bold uppercase text-sky-700">
                                  Promedio
                                </Text>
                                <Text className="mt-1 font-mono text-base font-extrabold text-sky-700">
                                  {formatMetricValue(metric, day.avg)}
                                </Text>
                                <Text className="mt-0.5 font-mono text-[8.5px] text-slate-500">
                                  {meta.unit} del día
                                </Text>
                              </View>

                              <View className="flex-1 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
                                <View className="flex-row items-center">
                                  <ArrowDownRight size={12} color="#059669" />
                                  <Text className="ml-0.5 font-mono text-[8.5px] font-bold uppercase text-emerald-700">
                                    Más bajo
                                  </Text>
                                </View>
                                <Text className="mt-1 font-mono text-sm font-extrabold text-slate-900">
                                  {formatMetricValue(metric, day.min)} <Text className="text-[9px] font-normal text-slate-500">{meta.unit}</Text>
                                </Text>
                                <View className="mt-1 flex-row items-center">
                                  <Clock size={10} color="#64748b" />
                                  <Text className="ml-1 font-mono text-[9px] text-slate-500">
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
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl border border-trauma-line bg-white p-4 shadow-md active:opacity-85">
      <View className="flex-row items-start justify-between">
        <Text className="h-8 font-mono text-xs text-trauma-ink">{label}</Text>
        <ChevronRight size={13} color="#94a3b8" />
      </View>
      <View className="my-2 flex-row items-baseline">
        <Text className="font-mono text-4xl text-trauma-ink">{value}</Text>
        {!!unit && <Text className="ml-1 font-mono text-[11px] text-trauma-muted">{unit}</Text>}
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <View
          className="h-full rounded-full bg-trauma-cyan"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </View>
      <Text className="mt-2 font-mono text-[8.5px] font-bold text-sky-600">
        Ver historial por día
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

  return (
    <View className="px-5 pb-10 pt-6">
      {/* Cabecera del Paciente */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-mono text-xl font-bold text-trauma-ink">Eliel Alfonso</Text>
        <Pressable
          onPress={() => router.navigate('/missions')}
          className="flex-row items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 active:opacity-75">
          <Flame size={13} color="#f97316" fill="#fb923c" />
          <Text className="ml-1 font-mono text-[10.5px] font-bold text-amber-800">
            {streakDays}d
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
        accessibilityLabel="Ver historial de pulso"
        className="mb-5 rounded-2xl border border-trauma-line bg-white p-4 shadow-md active:opacity-90">
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
                color={vitals.isAvailable ? '#ef4444' : '#94a3b8'}
                fill={vitals.isAvailable ? '#ef4444' : '#cbd5e1'}
              />
            </Animated.View>

            {vitals.isAvailable && vitals.heartRate !== null ? (
              <>
                <Text className="font-mono text-4xl font-extrabold text-trauma-ink">
                  {vitals.heartRate}
                </Text>
                <Text className="mb-1 ml-1 font-mono text-[10px] text-trauma-ink">Lpm</Text>
              </>
            ) : (
              <View className="mb-1">
                <Text className="font-mono text-xl font-bold text-slate-400">
                  Pulso no disponible
                </Text>
              </View>
            )}
          </View>

          <View className="items-end">
            <View className="flex-row items-center">
              <Activity size={12} color={vitals.isAvailable ? '#0284c7' : '#94a3b8'} />
              <Text
                className={`ml-1 font-mono text-[9.5px] font-bold ${vitals.isAvailable ? 'text-trauma-cyan' : 'text-slate-400'
                  }`}>
                {vitals.isAvailable ? 'Pulso en vivo' : 'Sin señal'}
              </Text>
              <ChevronRight size={13} color="#94a3b8" />
            </View>

            <Text className="mt-0.5 font-mono text-[8px] text-slate-400">
              {vitals.lastMeasuredAt ? `Último: ${vitals.lastMeasuredAt}` : 'Toca para ver historial'}
            </Text>
          </View>
        </View>

        {/* Gráfico animado de ECG coherente con el LPM actual */}
        <RealtimeEcgChart bpm={vitals.heartRate} isAvailable={vitals.isAvailable} />

        <View className="mt-1 flex-row items-center justify-between border-t border-slate-100 pt-2">
          <Text className="font-mono text-[9px] text-sky-600 font-bold">
            Toca aquí para ver historial de pulso
          </Text>
          <ChevronRight size={12} color="#0284c7" />
        </View>
      </Pressable>

      {/* Métricas secundarias: Oxígeno (SpO2) y Estrés */}
      <View className="mb-4 flex-row gap-4">
        <MetricCard
          label="Oxígeno"
          value={vitals.spo2 !== null ? `${vitals.spo2}%` : '--%'}
          percent={vitals.spo2 || 0}
          onPress={() => handleOpenMetricHistory('spo2')}
        />
        <MetricCard
          label={'Nivel de\nestrés'}
          value={
            vitals.stress !== null
              ? `${String(vitals.stress).padStart(2, '0')}/100`
              : '--/100'
          }
          percent={vitals.stress || 0}
          onPress={() => handleOpenMetricHistory('stress')}
        />
      </View>

      <Pressable
        onPress={() => handleOpenMetricHistory('sleep')}
        accessibilityLabel="Ver historial de sueño"
        className="mb-4 flex-row items-center justify-between rounded-2xl border border-violet-100 bg-white p-4 shadow-md active:opacity-85">
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
            <Moon size={20} color="#7c3aed" />
          </View>
          <View>
            <Text className="font-mono text-xs font-bold text-trauma-ink">
              Sueño registrado
            </Text>
            <Text className="mt-1 font-mono text-[9px] text-slate-500">
              Total diario leído del reloj · Ver historial
            </Text>
          </View>
        </View>
        <Text className="font-mono text-2xl font-extrabold text-violet-700">
          {vitals.sleepHours !== null ? `${vitals.sleepHours.toFixed(1)} h` : '-- h'}
        </Text>
      </Pressable>

      {/* Resumen de trayectoria y misiones diarias */}
      <Pressable
        onPress={() => router.navigate('/missions')}
        accessibilityLabel="Ver misiones y trayectoria"
        className="mb-5 active:opacity-90">
        <SpaceJourneyTimeline compact />
        <View className="mt-2 flex-row items-center justify-between rounded-xl border border-trauma-cyanEdge bg-trauma-cyanSoft/60 px-3.5 py-2">
          <Text className="font-mono text-[10.5px] font-bold text-trauma-ink">
            Misiones de hoy: {completedMissions}/{missions.length} completadas
          </Text>
          <ChevronRight size={14} color="#0284c7" />
        </View>
      </Pressable>

      {/* Pasos en superficie (Luna/Marte) o rutina opcional de caminadora en microgravedad (Nave) */}
      {environment === 'nave' ? (
        <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xs">
          <View className="flex-1 flex-row items-center pr-3">
            <View
              className={`mr-2.5 h-8 w-8 items-center justify-center rounded-xl ${treadmillRoutineActive ? 'bg-sky-50' : 'bg-slate-100'
                }`}>
              <Footprints size={16} color={treadmillRoutineActive ? '#0284c7' : '#64748b'} />
            </View>
            <View className="flex-1">
              <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                {treadmillRoutineActive ? 'Caminadora 0g activa' : 'En el espacio (0g)'}
              </Text>
              <Text className="font-mono text-xs font-bold text-slate-800">
                {treadmillRoutineActive
                  ? `${vitals.steps.toLocaleString()} pasos de rutina`
                  : 'Sin conteo automático de pasos'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={toggleTreadmillRoutine}
            className={`rounded-xl border px-3 py-1.5 active:opacity-75 ${treadmillRoutineActive
              ? 'border-slate-200 bg-slate-100'
              : 'border-trauma-cyanEdge bg-trauma-cyanSoft'
              }`}>
            <Text className="font-mono text-[10px] font-bold text-trauma-ink">
              {treadmillRoutineActive ? 'Finalizar' : 'Caminadora'}
            </Text>
          </Pressable>
        </View>
      ) : (
        vitals.steps > 0 && (
          <View className="mb-5 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xs">
            <View className="flex-row items-center">
              <View className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl bg-sky-50">
                <Footprints size={16} color="#0284c7" />
              </View>
              <View>
                <Text className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  Actividad física
                </Text>
                <Text className="font-mono text-xs font-bold text-slate-800">
                  Pasos registrados
                </Text>
              </View>
            </View>
            <Text className="font-mono text-base font-extrabold text-slate-900">
              {vitals.steps.toLocaleString()}
            </Text>
          </View>
        )
      )}

      {/* Reportar molestia → Navegación a Vista Corporal */}
      <View className="items-center mt-3">
        <Pressable
          onPress={() => router.navigate('/explore')}
          accessibilityLabel="Reportar molestia"
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
