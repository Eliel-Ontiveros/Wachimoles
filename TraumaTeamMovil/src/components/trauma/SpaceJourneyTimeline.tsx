import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Flag } from 'lucide-react-native';
import { ENVIRONMENTS, SPACE_LOCATIONS } from '../../services/mission-api';
import { EnvironmentType, SpaceLocation } from '../../types/mission';
import { useMission } from './mission-context';

const SHIP_SIZE = 32;
const TRACK_HEIGHT = 76;

const SPACE_STARS = [
  { x: 0.08, y: 0.18, r: 1.1, o: 0.7 },
  { x: 0.18, y: 0.42, r: 0.9, o: 0.5 },
  { x: 0.29, y: 0.14, r: 1.3, o: 0.85 },
  { x: 0.41, y: 0.34, r: 0.8, o: 0.45 },
  { x: 0.52, y: 0.12, r: 1.2, o: 0.75 },
  { x: 0.64, y: 0.28, r: 1.0, o: 0.6 },
  { x: 0.75, y: 0.15, r: 1.3, o: 0.9 },
  { x: 0.86, y: 0.38, r: 0.9, o: 0.55 },
  { x: 0.93, y: 0.18, r: 1.1, o: 0.7 },
  { x: 0.15, y: 0.78, r: 0.9, o: 0.5 },
  { x: 0.46, y: 0.72, r: 1.1, o: 0.65 },
  { x: 0.78, y: 0.82, r: 1.0, o: 0.55 },
];

function evalQuadBezier(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number]
): [number, number] {
  const mt = 1 - t;
  const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
  const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
  return [x, y];
}

// Astro animado genérico para origen y destino (Tierra, Estación, Luna o Marte)
function SpaceBodyBadge({ loc, isOrigin = false }: { loc: SpaceLocation; isOrigin?: boolean }) {
  const [anim] = useState(() => new Animated.Value(isOrigin ? 0 : 1));

  useEffect(() => {
    if (isOrigin) {
      const loop = Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: 9000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.09,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, isOrigin]);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const bodyIcon =
    loc === 'tierra' ? (
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} fill="#0284c7" />
        <Path
          d="M8 7c2 1 3 3 2 5-1 1-3 2-3 4 2 2 5 3 8 2-1-2 1-4 2-5-1-3-4-6-9-6z"
          fill="#34d399"
        />
      </Svg>
    ) : loc === 'marte' ? (
      <Svg width={26} height={26} viewBox="0 0 28 28">
        <Circle cx={14} cy={14} r={12} fill="#ea580c" opacity={0.28} />
        <Circle cx={14} cy={14} r={9.5} fill="#ea580c" />
        <Path d="M9 11c2-1 5-1 8 1M8 16c3 1 6 1 9-1" stroke="#fdba74" strokeWidth={1.5} fill="none" />
      </Svg>
    ) : loc === 'luna' ? (
      <Svg width={26} height={26} viewBox="0 0 28 28">
        <Circle cx={14} cy={14} r={12} fill="#38bdf8" opacity={0.22} />
        <Circle cx={14} cy={14} r={9.5} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={1} />
        <Circle cx={11} cy={11} r={2} fill="#64748b" />
        <Circle cx={17} cy={16} r={1.6} fill="#64748b" />
        <Circle cx={16} cy={10} r={1.1} fill="#64748b" />
      </Svg>
    ) : (
      <Svg width={26} height={26} viewBox="0 0 28 28">
        <Circle cx={14} cy={14} r={12} fill="#0ea5e9" opacity={0.25} />
        <Path
          d="M6 14h16M14 8v12M9 10v8M19 10v8"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Circle cx={14} cy={14} r={3} fill="#e0f2fe" />
      </Svg>
    );

  if (isOrigin) {
    return (
      <View className="items-center justify-center" style={{ width: 34, height: 34 }}>
        <Animated.View
          style={{
            position: 'absolute',
            width: 34,
            height: 34,
            transform: [{ rotate }],
          }}>
          <Svg width={34} height={34} viewBox="0 0 34 34">
            <Circle
              cx={17}
              cy={17}
              r={15}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.2}
              strokeDasharray="4,4"
            />
            <Circle cx={17} cy={2} r={2} fill="#38bdf8" />
          </Svg>
        </Animated.View>
        {bodyIcon}
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: anim }],
      }}>
      {bodyIcon}
    </Animated.View>
  );
}

// Línea de tiempo curva con fondo espacial (#060b19), origen, destino y navecita animada
export function SpaceJourneyTimeline({
  compact = false,
  previewDay,
  previewOrigin,
  previewDestination,
  previewEnvironment,
  previewDaysUntilDeparture,
  previewTotalDays,
}: {
  compact?: boolean;
  previewDay?: number;
  previewOrigin?: SpaceLocation;
  previewDestination?: SpaceLocation;
  previewEnvironment?: EnvironmentType;
  previewDaysUntilDeparture?: number;
  previewTotalDays?: number;
}) {
  const {
    missionDay,
    environment,
    origin,
    destination,
    daysUntilDeparture,
    totalMissionDays,
    arriveEarly,
  } = useMission();
  const [trackWidth, setTrackWidth] = useState(0);

  const [progressAnim] = useState(() => new Animated.Value(0));
  const [floatAnim] = useState(() => new Animated.Value(0));

  const activeOrigin = previewOrigin ?? origin;
  const activeDest = previewDestination ?? destination;
  const activeEnv = previewEnvironment ?? environment;
  const activeDay = previewDay ?? missionDay;
  const activeDaysUntil = previewDaysUntilDeparture ?? daysUntilDeparture;

  const originInfo = SPACE_LOCATIONS[activeOrigin];
  const destInfo = SPACE_LOCATIONS[activeDest];
  const envConfig = ENVIRONMENTS[activeEnv];

  const totalDays = previewTotalDays ?? totalMissionDays;
  const ratio = Math.max(0.06, Math.min(0.96, totalDays > 0 ? activeDay / totalDays : 0.06));
  const isPreview = previewDay !== undefined || previewOrigin !== undefined;
  const canArriveEarly = !compact && !isPreview && activeDaysUntil === 0 && activeDay < totalDays;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ratio, progressAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -2.5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 2.5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const geometry = useMemo(() => {
    if (trackWidth <= 0) return null;

    const p0: [number, number] = [20, TRACK_HEIGHT - 22];
    const p1: [number, number] = [trackWidth / 2, 4];
    const p2: [number, number] = [trackWidth - 20, TRACK_HEIGHT - 22];

    const steps = 20;
    const inputRange: number[] = [];
    const outputRangeX: number[] = [];
    const outputRangeY: number[] = [];
    let arcLength = 0;
    let prevPt = p0;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = evalQuadBezier(t, p0, p1, p2);
      if (i > 0) {
        arcLength += Math.hypot(pt[0] - prevPt[0], pt[1] - prevPt[1]);
      }
      prevPt = pt;
      inputRange.push(t);
      outputRangeX.push(pt[0] - SHIP_SIZE / 2);
      outputRangeY.push(pt[1] - SHIP_SIZE / 2);
    }

    const fullPathD = `M ${p0[0]} ${p0[1]} Q ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`;
    const filledLen = Math.max(0, arcLength * ratio);

    return {
      fullPathD,
      arcLength,
      filledLen,
      inputRange,
      outputRangeX,
      outputRangeY,
    };
  }, [trackWidth, ratio]);

  const shipTranslateX = geometry
    ? progressAnim.interpolate({
      inputRange: geometry.inputRange,
      outputRange: geometry.outputRangeX,
    })
    : 0;

  const shipTranslateY = geometry
    ? progressAnim.interpolate({
      inputRange: geometry.inputRange,
      outputRange: geometry.outputRangeY,
    })
    : 0;

  return (
    <View
      style={{ backgroundColor: '#060b19', borderColor: 'rgba(56, 189, 248, 0.25)' }}
      className={`overflow-hidden rounded-2xl border shadow-md ${compact ? 'p-3.5' : 'p-4'}`}>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-mono text-[9px] font-bold uppercase tracking-wider text-sky-400">
            {activeDaysUntil > 0
              ? `Despegue en ${activeDaysUntil} ${activeDaysUntil === 1 ? 'día' : 'días'}`
              : activeEnv === 'nave' && activeDest !== 'nave'
                ? 'En tránsito espacial'
                : envConfig.label}
          </Text>
          <Text className="font-mono text-xs font-bold text-slate-100">
            {originInfo.shortLabel} → {destInfo.label}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.14)',
            borderColor: 'rgba(56, 189, 248, 0.4)',
          }}
          className="rounded-lg border px-2.5 py-1">
          <Text className="font-mono text-[10px] font-bold text-sky-300">
            {activeDaysUntil > 0 ? `Sale en ${activeDaysUntil}d` : `Día ${activeDay} / ${totalDays}`}
          </Text>
        </View>
      </View>

      {/* Pista curva punteada sobre fondo estelar */}
      <View
        className="mt-2"
        style={{ height: TRACK_HEIGHT }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        {geometry && (
          <>
            <Svg
              width={trackWidth}
              height={TRACK_HEIGHT}
              style={{ position: 'absolute', top: 0, left: 0 }}>
              {SPACE_STARS.map((st, idx) => (
                <Circle
                  key={idx}
                  cx={st.x * trackWidth}
                  cy={st.y * TRACK_HEIGHT}
                  r={st.r}
                  fill="#e0f2fe"
                  opacity={st.o}
                />
              ))}
              <Path
                d={geometry.fullPathD}
                fill="none"
                stroke="#334155"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
              <Path
                d={geometry.fullPathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2.4}
                strokeDasharray={`${geometry.filledLen.toFixed(1)},${geometry.arcLength.toFixed(1)}`}
                strokeLinecap="round"
              />
            </Svg>

            {/* Astro origen animado */}
            <View
              style={{
                position: 'absolute',
                left: 3,
                top: TRACK_HEIGHT - 39,
              }}>
              <SpaceBodyBadge loc={activeOrigin} isOrigin />
            </View>

            {/* Astro destino animado */}
            <View
              style={{
                position: 'absolute',
                right: 3,
                top: TRACK_HEIGHT - 39,
              }}>
              <SpaceBodyBadge loc={activeDest} />
            </View>

            {/* Navecita siguiendo la trayectoria curva (solo transform nativo) */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: SHIP_SIZE,
                height: SHIP_SIZE,
                transform: [{ translateX: shipTranslateX }, { translateY: shipTranslateY }],
              }}>
              <Animated.View
                style={{
                  width: SHIP_SIZE,
                  height: SHIP_SIZE,
                  transform: [{ translateY: floatAnim }],
                }}>
                <View className="h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-sky-400 bg-slate-900 shadow-sm">
                  <Image
                    source={require('@/assets/images/a2.jpg')}
                    style={{ width: 24, height: 24 }}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>
            </Animated.View>
          </>
        )}
      </View>

      {/* Leyenda de días de la trayectoria */}
      <View
        style={{ borderTopColor: 'rgba(148, 163, 184, 0.18)' }}
        className="mt-1 flex-row items-center justify-between border-t pt-2">
        <View className="flex-row items-center">
          <View className="mr-1.5 h-2 w-2 rounded-full bg-sky-400" />
          <Text className="font-mono text-[9px] text-slate-300">
            Día 0 · {originInfo.shortLabel}
          </Text>
        </View>

        <View
          style={{ backgroundColor: 'rgba(56, 189, 248, 0.16)' }}
          className="rounded-md px-2 py-0.5">
          <Text className="font-mono text-[9px] font-bold text-sky-300">
            Día {activeDay} ({Math.round((activeDay / totalDays) * 100)}%)
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="font-mono text-[9px] text-slate-300">
            Día {totalDays} · {destInfo.shortLabel}
          </Text>
          <View className="ml-1.5 h-2 w-2 rounded-full bg-slate-500" />
        </View>
      </View>

      {canArriveEarly && (
        <Pressable
          onPress={arriveEarly}
          accessibilityLabel="Marcar llegada anticipada"
          style={{
            backgroundColor: 'rgba(56, 189, 248, 0.14)',
            borderColor: 'rgba(56, 189, 248, 0.35)',
          }}
          className="mt-2.5 flex-row items-center justify-center rounded-xl border py-2 active:opacity-75">
          <Flag size={12} color="#38bdf8" />
          <Text className="ml-1.5 font-mono text-[10.5px] font-bold text-sky-300">
            Llegué antes a {destInfo.shortLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
