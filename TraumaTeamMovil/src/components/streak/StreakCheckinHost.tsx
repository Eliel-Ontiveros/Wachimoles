import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  closeStreakCheckin,
  getStreakCheckinRequest,
  subscribeStreakCheckin,
  type StreakCheckinRequest,
} from './streak-checkin';

const FIRE = require('../../../assets/lottie/fire.json');
const ROCKET = require('../../../assets/lottie/rocket.json');

// Valores tomados de la referencia (streak-checkin.html)
const FIRE_COLOR = '#ff7a1a';
const FIRE_COLOR_2 = '#ffc83d';
const OFF_COLOR = '#8d86ad';
const ANGLE_DEG = 42;
const FLIGHT_MS = 1400;
const START_DELAY = 500;
const ROCKET_SIZE = 300;
const FIRE_SIZE = 260;
const SPARK_COLORS = ['#ffc83d', '#ff7a1a', '#ff4d2e', '#fff1b8'];
const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const FLIGHT_EASING = Easing.bezier(0.55, 0.05, 0.4, 1);
const OFF_FILTER =
  Platform.OS === 'web'
    ? ({ filter: 'grayscale(1) brightness(0.55)' } as object)
    : ({ filter: [{ grayscale: 1 }, { brightness: 0.55 }] } as object);

interface SparkSpec {
  id: number;
  angle: number;
  dist: number;
  size: number;
  color: string;
  duration: number;
}

const Spark = memo(function Spark({ angle, dist, size, color, duration }: SparkSpec) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration, easing: Easing.bezier(0.1, 0.7, 0.4, 1) });
    return () => cancelAnimation(p);
  }, [p, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.6, 1], [1, 1, 0]),
    transform: [
      { translateX: interpolate(p.value, [0, 0.6, 1], [0, Math.cos(angle) * dist, Math.cos(angle) * dist * 1.15]) },
      { translateY: interpolate(p.value, [0, 0.6, 1], [0, Math.sin(angle) * dist - 30, Math.sin(angle) * dist * 1.15 + 40]) },
      { scale: interpolate(p.value, [0, 0.6, 1], [1, 0.8, 0.2]) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: FIRE_SIZE / 2 - size / 2,
          top: FIRE_SIZE / 2 - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          zIndex: 3,
        },
        style,
      ]}
    />
  );
});

function Dot({ done, today, pop, reduce }: { done: boolean; today: boolean; pop: boolean; reduce: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (!pop || reduce) return;
    s.value = withDelay(
      250,
      withSequence(
        withTiming(1.4, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 270, easing: Easing.bezier(0.3, 1.6, 0.5, 1) }),
      ),
    );
    return () => cancelAnimation(s);
  }, [pop, reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View
      style={[
        styles.dot,
        done && { backgroundColor: FIRE_COLOR, borderColor: FIRE_COLOR_2 },
        today && { borderColor: FIRE_COLOR_2 },
        style,
      ]}>
      {done ? <Text style={styles.dotCheck}>✓</Text> : null}
    </Animated.View>
  );
}

function StreakCheckinStage({ req }: { req: StreakCheckinRequest }) {
  const { width, height } = useWindowDimensions();
  // El escenario ocupa toda la pantalla (sin bordes que recorten onda/destello);
  // el contenido va centrado en la columna de la tarjeta.
  const sw = width;
  const sh = height;

  const streak = Math.max(1, Math.round(req.streak));
  const prev = Math.max(0, streak - 1);
  const todayIndex = req.todayIndex ?? new Date().getDay();

  const [reduce, setReduce] = useState<boolean | null>(null);
  const [todayDone, setTodayDone] = useState(false);
  const [ctaOn, setCtaOn] = useState(false);
  const [sparks, setSparks] = useState<SparkSpec[]>([]);
  const [fireCenter, setFireCenter] = useState({ x: sw / 2, y: sh * 0.4 });

  const reqRef = useRef(req);
  useEffect(() => {
    reqRef.current = req;
  });
  const fireLottie = useRef<LottieView>(null);
  const rocketLottie = useRef<LottieView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // Valores animados
  const lit = useSharedValue(0); // 0 apagado → 1 encendido (color, capa viva, glow)
  const fireScale = useSharedValue(0.82);
  const glowBreath = useSharedValue(0.94);
  const ring = useSharedValue(0);
  const flash = useSharedValue(0);
  const enter = useSharedValue(0); // entrada escalonada de los elementos
  const exit = useSharedValue(1); // salida suave al cerrar
  const closing = useRef(false);
  const roll = useSharedValue(0);
  const countScale = useSharedValue(1);
  const labelOn = useSharedValue(0);
  const ctaAnim = useSharedValue(0);
  const rocketP = useSharedValue(0);
  const rocketOpacity = useSharedValue(0);
  const fired = useSharedValue(false);

  // Reduced motion (en web usa prefers-reduced-motion)
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(!!v))
      .catch(() => alive && setReduce(false));
    return () => {
      alive = false;
    };
  }, []);

  const onWrapLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, y, width: w, height: h } = e.nativeEvent.layout;
      setFireCenter({ x: x + w / 2, y: y + h / 2 });
    },
    [],
  );

  const finishCounter = (isReduced: boolean) => {
    if (isReduced) {
      roll.value = 1;
    } else {
      roll.value = withTiming(1, { duration: 380, easing: Easing.bezier(0.5, 0, 0.2, 1) });
      countScale.value = withDelay(
        200,
        withSequence(
          withTiming(1.18, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        ),
      );
    }
    setTodayDone(true);
    later(() => {
      setCtaOn(true);
      ctaAnim.value = withTiming(1, { duration: isReduced ? 0 : 400 });
      reqRef.current.onDone?.();
    }, isReduced ? 0 : 700);
  };

  const ignite = (isReduced: boolean) => {
    fireLottie.current?.play();
    lit.value = withTiming(1, { duration: isReduced ? 0 : 600 });
    labelOn.value = withTiming(1, { duration: isReduced ? 0 : 500 });
    reqRef.current.onIgnite?.();
    if (isReduced) {
      fireScale.value = 1;
      finishCounter(true);
      return;
    }
    glowBreath.value = withDelay(
      500,
      withRepeat(withTiming(1.06, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    fireScale.value = withSequence(
      withTiming(1.22, { duration: 315, easing: Easing.bezier(0.2, 0.8, 0.3, 1) }),
      withTiming(0.96, { duration: 210, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 175, easing: Easing.out(Easing.quad) }),
    );
    ring.value = 0;
    ring.value = withTiming(1, { duration: 800, easing: Easing.bezier(0.1, 0.7, 0.3, 1) });
    flash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 480 }),
    );
    setSparks(
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        angle: Math.random() * Math.PI * 2,
        dist: 90 + Math.random() * 140,
        size: 5 + Math.random() * 8,
        color: SPARK_COLORS[i % SPARK_COLORS.length],
        duration: 900 + Math.random() * 500,
      })),
    );
    later(() => finishCounter(false), 180);
  };

  // Siempre apuntan al `ignite` del render más reciente (lo invoca el worklet).
  const igniteRef = useRef(ignite);
  useEffect(() => {
    igniteRef.current = ignite;
  });
  const igniteFromRocket = useCallback(() => igniteRef.current(false), []);

  // El cohete enciende el fuego exactamente al cruzar su centro (50% del recorrido).
  useAnimatedReaction(
    () => rocketP.value >= 0.5,
    (atCenter) => {
      if (atCenter && !fired.value) {
        fired.value = true;
        scheduleOnRN(igniteFromRocket);
      }
    },
  );

  // Secuencia principal
  useEffect(() => {
    if (reduce === null) return;
    const pending = timers.current;
    enter.value = withTiming(1, { duration: reduce ? 0 : 550, easing: Easing.out(Easing.cubic) });
    if (reduce) {
      later(() => igniteRef.current(true), 200);
    } else {
      later(() => {
        rocketOpacity.value = 1;
        rocketLottie.current?.play();
        rocketP.value = withTiming(1, { duration: FLIGHT_MS, easing: FLIGHT_EASING }, (done) => {
          if (done) rocketOpacity.value = 0;
        });
        later(() => rocketLottie.current?.pause(), FLIGHT_MS);
      }, START_DELAY);
    }
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
      [lit, fireScale, glowBreath, ring, flash, roll, countScale, labelOn, ctaAnim, rocketP, rocketOpacity, enter, exit].forEach(
        cancelAnimation,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    reqRef.current.onClose?.();
    if (reduce) {
      closeStreakCheckin(req.id);
      return;
    }
    exit.set(withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }));
    later(() => closeStreakCheckin(req.id), 230);
  };

  /* ---------- estilos animados ---------- */
  const win = (a: number, b: number) => {
    'worklet';
    return interpolate(enter.value, [a, b], [0, 1], Extrapolation.CLAMP);
  };
  const scrimStyle = useAnimatedStyle(() => ({ opacity: win(0, 0.35) }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value }));
  const fireStyle = useAnimatedStyle(() => ({
    opacity: win(0, 0.6),
    transform: [{ scale: fireScale.value * (0.85 + 0.15 * win(0, 0.6)) }],
  }));
  const weekStyle = useAnimatedStyle(() => ({
    opacity: win(0.35, 0.9),
    transform: [{ translateY: (1 - win(0.35, 0.9)) * 14 }],
  }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - lit.value) }));
  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scale: glowBreath.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : interpolate(ring.value, [0, 1], [0.95, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.3, 3.2]) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const countStyle = useAnimatedStyle(() => ({
    opacity: win(0.15, 0.7),
    transform: [{ translateY: (1 - win(0.15, 0.7)) * 14 }, { scale: countScale.value }],
  }));
  const numAStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -roll.value * 112 }],
    color: interpolateColor(lit.value, [0, 1], [OFF_COLOR, FIRE_COLOR]),
  }));
  const numBStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - roll.value) * 112 }],
    color: interpolateColor(lit.value, [0, 1], [OFF_COLOR, FIRE_COLOR]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOn.value,
    transform: [{ translateY: (1 - labelOn.value) * 8 }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaAnim.value,
    transform: [{ translateY: (1 - ctaAnim.value) * 14 }],
  }));
  const rocketStyle = useAnimatedStyle(() => {
    const th = (ANGLE_DEG * Math.PI) / 180;
    const L = Math.hypot(sw, sh) * 0.6 + ROCKET_SIZE / 2;
    const t = -1 + 2 * rocketP.value;
    return {
      opacity: rocketOpacity.value,
      transform: [
        { translateX: fireCenter.x + Math.cos(th) * L * t - ROCKET_SIZE / 2 },
        { translateY: fireCenter.y - Math.sin(th) * L * t - ROCKET_SIZE / 2 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.stage, { width: sw, height: sh }, rootStyle]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      {/* Destello de pantalla, centrado en el fuego */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 4 }, flashStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient
              id="flash"
              cx={fireCenter.x}
              cy={fireCenter.y}
              r={Math.max(sw, sh) * 0.45}
              gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#fff6d8" stopOpacity={0.8} />
              <Stop offset="1" stopColor="#fff6d8" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#flash)" />
        </Svg>
      </Animated.View>

      <View style={styles.card}>
        <View style={styles.fireWrap} onLayout={onWrapLayout}>
          <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]}>
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#ff9a2e" stopOpacity={0.6} />
                  <Stop offset="0.55" stopColor="#ff7a1a" stopOpacity={0.2} />
                  <Stop offset="0.75" stopColor="#ff7a1a" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="50%" cy="50%" r="50%" fill="url(#glow)" />
            </Svg>
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

          <Animated.View pointerEvents="none" style={[styles.fire, fireStyle]}>
            {/* Apagado: frame 0, en pausa, en escala de grises */}
            <Animated.View style={[StyleSheet.absoluteFill, OFF_FILTER, offStyle]}>
              <LottieView source={FIRE} autoPlay={false} loop={false} style={StyleSheet.absoluteFill} />
            </Animated.View>
            {/* Encendido: se hace play en la ignición */}
            <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
              <LottieView ref={fireLottie} source={FIRE} loop autoPlay={false} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Animated.View>

          {sparks.map((s) => (
            <Spark key={s.id} {...s} />
          ))}
        </View>

        <Animated.View style={[styles.count, countStyle]}>
          <Animated.Text style={[styles.num, numAStyle]}>{prev}</Animated.Text>
          <Animated.Text style={[styles.num, numBStyle]}>{streak}</Animated.Text>
        </Animated.View>
        <Animated.Text style={[styles.label, labelStyle]}>días de racha</Animated.Text>
        <Animated.Text style={[styles.sub, labelStyle]}>¡Sigue así, no pares ahora!</Animated.Text>

        <Animated.View style={[styles.week, weekStyle]}>
          {DAYS.map((d, i) => {
            const doneBefore = i < todayIndex && todayIndex - i <= prev;
            const isToday = i === todayIndex;
            return (
              <View key={i} style={styles.day}>
                <Dot
                  done={doneBefore || (isToday && todayDone)}
                  today={isToday}
                  pop={isToday && todayDone}
                  reduce={!!reduce}
                />
                <Text style={styles.dayLabel}>{d}</Text>
              </View>
            );
          })}
        </Animated.View>

        <Animated.View style={[{ marginTop: 34 }, ctaStyle]} pointerEvents={ctaOn ? 'auto' : 'none'}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            onPress={close}
            disabled={!ctaOn}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaText}>CONTINUAR</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Cohete: cruza en diagonal por el centro del fuego */}
      <Animated.View pointerEvents="none" style={[styles.rocket, rocketStyle]}>
        <LottieView ref={rocketLottie} source={ROCKET} loop autoPlay={false} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

export function StreakCheckinHost() {
  const req = useSyncExternalStore(subscribeStreakCheckin, getStreakCheckinRequest, getStreakCheckinRequest);
  if (!req) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        req.onClose?.();
        closeStreakCheckin(req.id);
      }}>
      <View style={styles.backdrop}>
        {/* key: una nueva petición remonta todo y libera timers/Lottie anteriores */}
        <StreakCheckinStage key={req.id} req={req} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stage: { overflow: 'hidden' },
  scrim: { backgroundColor: 'rgba(13,13,20,0.95)' },
  card: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1 },
  fireWrap: { width: FIRE_SIZE, height: FIRE_SIZE, alignItems: 'center', justifyContent: 'center' },
  fire: { width: FIRE_SIZE, height: FIRE_SIZE, zIndex: 2 },
  glow: {
    position: 'absolute',
    width: FIRE_SIZE * 1.6,
    height: FIRE_SIZE * 1.6,
    left: -FIRE_SIZE * 0.3,
    top: -FIRE_SIZE * 0.3,
  },
  ring: {
    position: 'absolute',
    left: (FIRE_SIZE - 120) / 2,
    top: (FIRE_SIZE - 120) / 2,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: FIRE_COLOR_2,
    opacity: 0,
    zIndex: 1,
  },
  count: { height: 112, width: 240, overflow: 'hidden', marginTop: -6 },
  num: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 112,
    textAlign: 'center',
    fontSize: 96,
    lineHeight: 112,
    fontWeight: '900',
    letterSpacing: -2,
  },
  label: { fontSize: 20, fontWeight: '800', color: FIRE_COLOR, opacity: 0 },
  sub: { fontSize: 14, color: '#b9b3d6', marginTop: 2, height: 20, opacity: 0 },
  week: { flexDirection: 'row', gap: 10, marginTop: 26 },
  day: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 12, fontWeight: '800', color: OFF_COLOR },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dotCheck: { color: '#fff', fontSize: 16, fontWeight: '900' },
  cta: {
    width: 260,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: FIRE_COLOR_2,
    borderBottomWidth: 5,
    borderBottomColor: '#d99a12',
  },
  ctaPressed: { transform: [{ translateY: 4 }], borderBottomWidth: 1 },
  ctaText: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5, color: '#5a2b00' },
  rocket: { position: 'absolute', left: 0, top: 0, width: ROCKET_SIZE, height: ROCKET_SIZE, zIndex: 5 },
});
