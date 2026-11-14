import { useEffect, useId, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

type Props = { size: number; listening: boolean; thinking: boolean; level: Animated.Value };

type Blob = { color: string; dur: number; dir: 1 | -1; ox: number; oy: number; r: number };

const BLOBS: Blob[] = [
  { color: '#58d5f7', dur: 7000, dir: 1, ox: 0.18, oy: -0.1, r: 0.46 },
  { color: '#8b5cf6', dur: 9000, dir: -1, ox: -0.16, oy: 0.14, r: 0.5 },
  { color: '#ec4899', dur: 11000, dir: 1, ox: 0.04, oy: 0.2, r: 0.36 },
  { color: '#7dd3fc', dur: 8000, dir: -1, ox: -0.12, oy: -0.18, r: 0.34 },
];

function SpinningBlob({ blob, size, index, fast }: { blob: Blob; size: number; index: number; fast: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: fast ? blob.dur / 2.5 : blob.dur,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, fast, blob.dur]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: blob.dir === 1 ? ['0deg', '360deg'] : ['360deg', '0deg'],
  });
  const gid = `g${uid}${index}`;
  const cx = size / 2 + blob.ox * size;
  const cy = size / 2 + blob.oy * size;

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx={cx} cy={cy} r={blob.r * size} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={blob.color} stopOpacity={0.95} />
            <Stop offset="0.55" stopColor={blob.color} stopOpacity={0.4} />
            <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={blob.r * size} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

/** Esfera luminosa estilo Siri: reacciona a la voz (level), respira en reposo y gira rápido al pensar. */
export function VoiceOrb({ size, listening, thinking, level }: Props) {
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    breath.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: thinking ? 700 : 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: thinking ? 700 : 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, thinking]);

  const halo = size * 1.7;
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const haloScale = listening
    ? level.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.3], extrapolate: 'clamp' })
    : breathScale;
  const haloOpacity = listening
    ? level.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9], extrapolate: 'clamp' })
    : breath.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });
  const coreScale = listening
    ? level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08], extrapolate: 'clamp' })
    : breathScale;

  return (
    <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 1.35,
          height: size * 1.35,
          borderRadius: size,
          backgroundColor: thinking ? 'rgba(139,92,246,0.5)' : 'rgba(88,213,247,0.45)',
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
          shadowColor: '#58d5f7',
          shadowOpacity: 0.9,
          shadowRadius: size * 0.35,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: '#05070f',
          borderWidth: 1,
          borderColor: 'rgba(125,211,252,0.45)',
          transform: [{ scale: coreScale }],
        }}>
        {BLOBS.map((b, i) => (
          <SpinningBlob key={i} blob={b} size={size} index={i} fast={thinking || listening} />
        ))}
      </Animated.View>
    </View>
  );
}
