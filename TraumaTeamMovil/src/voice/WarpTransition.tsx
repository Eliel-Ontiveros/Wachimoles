import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export type WarpTrip = { id: number; label: string; heading: string };

const STAR_COUNT = 56;
const IN_MS = 560;
const OUT_MS = 520;
const GOLDEN = 137.508;

/**
 * Salto a hiperespacio: estrellas que se estiran desde el centro, fundido a la
 * noche espacial, navegación en el pico y salida hacia la nueva pantalla.
 * Con "reducir movimiento" activo se usa un fundido simple.
 */
export function WarpTransition({
  trip,
  onPeak,
  onDone,
}: {
  trip: WarpTrip | null;
  onPeak: (id: number) => void;
  onDone: (id: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [veil] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Distribución determinista (ángulo áureo) para que no cambie entre renders.
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        angle: (i * GOLDEN) % 360,
        start: 0.08 + ((i * 37) % 100) / 100 * 0.35,
        delay: ((i * 53) % 100) / 100 * 0.35,
        thick: i % 5 === 0 ? 3 : 1.5,
        color: i % 7 === 0 ? '#c4b5fd' : i % 3 === 0 ? '#7dd3fc' : '#ffffff',
      })),
    []
  );
  const reach = Math.hypot(width, height) / 2;

  useEffect(() => {
    if (!trip) return;
    progress.setValue(0);
    veil.setValue(0);
    const fast = reduceMotion;
    Animated.parallel([
      Animated.timing(veil, { toValue: 1, duration: fast ? 160 : IN_MS * 0.7, useNativeDriver: true }),
      Animated.timing(progress, {
        toValue: 1,
        duration: fast ? 160 : IN_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPeak(trip.id);
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 2,
          duration: fast ? 1 : OUT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(veil, {
          toValue: 0,
          duration: fast ? 200 : OUT_MS,
          delay: fast ? 0 : 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => onDone(trip.id));
    });
  }, [trip, progress, veil, reduceMotion, onPeak, onDone]);

  if (!trip) return null;

  const labelOpacity = progress.interpolate({
    inputRange: [0, 0.6, 1, 1.4, 2],
    outputRange: [0, 1, 1, 0, 0],
  });
  const labelScale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.92, 1, 1.15] });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { opacity: veil, zIndex: 100 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#05070f' }]} />
      {!reduceMotion &&
        stars.map((s, i) => {
          const local = progress.interpolate({
            inputRange: [0, s.delay, 2],
            outputRange: [0, 0, 2 - s.delay],
            extrapolate: 'clamp',
          });
          const dist = local.interpolate({
            inputRange: [0, 1, 2],
            outputRange: [s.start * reach, reach * 0.9, reach * 1.6],
          });
          const stretch = local.interpolate({ inputRange: [0, 0.8, 1.2, 2], outputRange: [1, 18, 30, 4] });
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: width / 2,
                top: height / 2,
                width: 0,
                height: 0,
                transform: [{ rotate: `${s.angle}deg` }],
              }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  width: s.thick,
                  height: 4,
                  marginLeft: -s.thick / 2,
                  borderRadius: s.thick,
                  backgroundColor: s.color,
                  opacity: local.interpolate({ inputRange: [0, 0.15, 1.6, 2], outputRange: [0, 0.9, 0.7, 0] }),
                  transform: [{ translateY: Animated.multiply(dist, -1) }, { scaleY: stretch }],
                }}
              />
            </View>
          );
        })}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center', opacity: labelOpacity, transform: [{ scale: labelScale }] },
        ]}>
        <View style={styles.glow} />
        <Text style={styles.heading}>{trip.heading.toUpperCase()}</Text>
        <Text style={styles.label}>{trip.label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(88,213,247,0.10)',
    shadowColor: '#58d5f7',
    shadowOpacity: 0.8,
    shadowRadius: 60,
  },
  heading: { color: '#7dd3fc', fontFamily: 'monospace', fontSize: 11, letterSpacing: 4, fontWeight: '700' },
  label: { color: '#ffffff', fontFamily: 'monospace', fontSize: 22, fontWeight: '800', marginTop: 6 },
});
