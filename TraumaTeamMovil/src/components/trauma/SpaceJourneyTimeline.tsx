import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { ChevronDown, ClockPlus, X } from 'lucide-react-native';
import {
  formatRouteDays,
  getDelayPresetDays,
  getEnvironmentText,
  getLocationText,
  getRouteDurationSpec,
} from '../../services/mission-api';
import { useI18n } from '@/i18n/I18nProvider';
import { EnvironmentType, SpaceLocation } from '../../types/mission';
import { EnvironmentPickerModal } from './EnvironmentSelector';
import {
  ROCKET_NOZZLE_BY_ENV,
  SpaceBannerBackdrop,
  SpaceBannerRocket,
} from './SpaceBannerArtwork';
import { useMission } from './mission-context';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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

type SpaceBodyVectorSpec =
  | {
      kind: 'path';
      width: number;
      height: number;
      viewBox: string;
      color: string;
      d: string;
    }
  | {
      kind: 'polygon';
      width: number;
      height: number;
      viewBox: string;
      color: string;
      points: string;
    };

// Iconos vectoriales de assets/images/Icons teñidos con el color de cada planeta/estación
const SPACE_BODY_VECTORS: Record<SpaceLocation, SpaceBodyVectorSpec> = {
  tierra: {
    kind: 'path',
    width: 23,
    height: 23,
    viewBox: '0 0 68.87 68.89',
    color: '#0ea5e9',
    d: 'M1.18,43.41c5.46,20.1,27.2,30.79,46.45,22.85,15.88-6.55,24.56-24.2,20.06-40.78C62.23,5.39,40.49-5.31,21.24,2.64,5.37,9.19-3.32,26.83,1.18,43.41ZM13.03,53.02c-5.76-5.85-6.96-13.43-7.27-16.59-.46-4.82-.04-11.91,2.15-12.4,1.05-.23,2.17,1.11,2.81,1.88,3.46,4.17,1.33,7.62,3.43,14.01,1.54,4.72,3.55,5.41,4.89,11.41.41,1.83,1,4.59-.05,5.23C17.49,57.49,13.54,53.54,13.03,53.02ZM50.03,37.63c.46.07.91.19,1.33.39,1.49.73,2.86,1.96,3.18,2.82,1.24,3.33-9.91,6.84-11.9,15.72-.72,3.21.24,5.03-1.38,6.53-2.31,2.14-7.2,1.21-10.24-.75-6.41-4.11-5.98-13.64-5.96-14.06.02-.37.03-.55.07-.79C27.08,35.77,40.89,36.3,50.03,37.63ZM60.93,23.57c.24,1.1.09,2.28-.45,3.27-3.19,5.86-10.59.67-16.26-1.03-.95-.28-1.98-.3-2.93.01-14.99,4.86-29.27-4.26-19.09-18.46.59-.82,1.42-1.45,2.36-1.8C37.76.68,58.03,10,60.93,23.57Z',
  },
  estacion: {
    kind: 'polygon',
    width: 21,
    height: 18,
    viewBox: '0 0 96.31 82.6',
    color: '#7dd3fc',
    points:
      '79.26,14.28 67.61,39.13 58.83,35.02 63.07,25.97 64.91,26.84 67.63,21.04 65.78,20.18 67.95,15.54 55.58,9.74 53.41,14.38 51.56,13.51 48.84,19.3 50.69,20.17 46.45,29.21 37.17,24.86 49.62,1.88 27.42,0 0,50.6 22.21,52.48 33.84,31.01 43.49,35.54 38.24,46.73 36.68,45.99 32.93,53.98 34.5,54.71 29.25,65.92 32.18,67.29 28.57,75 35.08,78.05 38.69,70.35 41.62,71.72 46.88,60.51 48.44,61.25 52.19,53.26 50.62,52.53 55.86,41.34 64.65,45.45 54.83,66.39 71.88,82.6 96.31,30.49 79.26,14.28',
  },
  luna: {
    kind: 'path',
    width: 23,
    height: 23,
    viewBox: '0 0 68.19 68.19',
    color: '#cbd5e1',
    d: 'M34.1,0C15.27,0,0,15.27,0,34.1s15.27,34.09,34.1,34.09,34.09-15.26,34.09-34.09S52.93,0,34.1,0ZM13.66,33.23c-12.81,1.7-7.17-19.9,1.81-21.74C26.93,11.19,19.59,29.76,13.66,33.23ZM29.73,64.57c-4.99.38-12.26-2.14-9.85-5.85.66-1.02,1.79-1.64,3-1.82,2.42-.35,5.8.06,8.16,1.23C34.09,59.64,33.13,64.32,29.73,64.57ZM34.3,50.85c-8.39,3.27-23.68-7.53-13.33-14.84C29.03,32.13,45.93,44.74,34.3,50.85ZM39.94,30c-1.76,6.03-10.98,2.69-9.64-2.99C32.21,19.85,41.86,23.16,39.94,30ZM41.08,10.51c.28-13.34,22.61,6.22,8.75,9.1C44.61,19.89,42.34,14.68,41.08,10.51ZM61.51,50.77c-.89,4.96-7.96,10.78-11.55,7.55-1.47-1.33-1.57-3.6-.47-5.25,2.98-4.49,10.97-9.72,12.02-3.41C61.57,50.02,61.57,50.41,61.51,50.77ZM61.55,34.11c-1.06,4.88-4.48,10.8-10.18,10.43C32.17,39.71,61.51,12.65,61.55,34.11Z',
  },
  marte: {
    kind: 'path',
    width: 23,
    height: 23,
    viewBox: '0 0 71.8 71.8',
    color: '#f97316',
    d: 'M35.9,0C16.07,0,0,16.07,0,35.9s16.07,35.9,35.9,35.9,35.9-16.08,35.9-35.9S55.72,0,35.9,0ZM28.17,55.15l-4.96,1.42-2.75,2.33-6.61-2.37-1.26-6.92,5.36-4.54.53.19,6.35-1.81,5.04,4.89L28.17,55.15ZM35.52,27.84l-6.66,2.22-.49,2.36-6.66,2.22-5.26-4.67.48-2.35-5.25-4.66,2.82-13.77,13.33-4.44,5.08,4.51,1.15-.97,6.61,2.37,1.26,6.92-5.21,4.41L35.52,27.84ZM57.03,53.32l-6.67,2.22-1.17-1.03-2.05,3.56h-7.03s-3.51-6.09-3.51-6.09l3.51-6.08h6.02s.39-1.9.39-1.9l4.13-1.38-.22-4.02,5.88-3.84,6.27,3.17.39,7.02-4.88,3.19L57.03,53.32Z',
  },
};

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
          useNativeDriver: USE_NATIVE_DRIVER,
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
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
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

  const spec = SPACE_BODY_VECTORS[loc];
  const bodyIcon = (
    <Svg width={spec.width} height={spec.height} viewBox={spec.viewBox}>
      {spec.kind === 'polygon' ? (
        <Polygon fill={spec.color} points={spec.points} />
      ) : (
        <Path fill={spec.color} d={spec.d} />
      )}
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

const BANNER_ASPECT_RATIO = 809.1 / 250.66;

const PARKED_STARS = [
  { left: '8%', top: '34%', size: 2.5, phase: 0 as const, color: '#ffffff' },
  { left: '16%', top: '26%', size: 2, phase: 1 as const, color: '#bae6fd' },
  { left: '25%', top: '14%', size: 3, phase: 2 as const, color: '#e0f2fe' },
  { left: '34%', top: '30%', size: 2, phase: 0 as const, color: '#ffffff' },
  { left: '42%', top: '12%', size: 2.5, phase: 1 as const, color: '#bae6fd' },
  { left: '53%', top: '18%', size: 3, phase: 2 as const, color: '#ffffff' },
  { left: '63%', top: '11%', size: 2, phase: 0 as const, color: '#e0f2fe' },
  { left: '72%', top: '27%', size: 2.5, phase: 1 as const, color: '#ffffff' },
  { left: '82%', top: '14%', size: 3, phase: 2 as const, color: '#bae6fd' },
  { left: '90%', top: '24%', size: 2, phase: 0 as const, color: '#ffffff' },
  { left: '92%', top: '42%', size: 2.5, phase: 1 as const, color: '#e0f2fe' },
  { left: '20%', top: '46%', size: 2, phase: 2 as const, color: '#bae6fd' },
] as const;

const PARKED_SPARKLES = [
  { left: '29%', top: '20%', size: 10, phase: 0 as const, color: '#e0f2fe' },
  { left: '48%', top: '10%', size: 8, phase: 1 as const, color: '#ffffff' },
  { left: '67%', top: '16%', size: 11, phase: 2 as const, color: '#bae6fd' },
  { left: '86%', top: '18%', size: 9, phase: 0 as const, color: '#ffffff' },
  { left: '12%', top: '42%', size: 8, phase: 2 as const, color: '#bae6fd' },
] as const;

// Nubes suaves para el cielo diurno del banner de Tierra
const EARTH_CLOUDS = [
  { top: '13%', width: 62, height: 22, opacity: 0.86, rangeX: [-70, 400] as const, track: 'a' as const },
  { top: '29%', width: 46, height: 16, opacity: 0.72, rangeX: [-50, 420] as const, track: 'b' as const },
  { top: '9%', width: 40, height: 14, opacity: 0.64, rangeX: [-165, 365] as const, track: 'a' as const },
] as const;

const EARTH_BIRDS = [
  { left: '24%', top: '23%', size: 14, phase: 0 as const },
  { left: '30%', top: '19%', size: 11, phase: 1 as const },
] as const;

function ParkedBannerAnimatedOverlay({
  environment,
  compact,
  statusLabel,
  locationLabel,
}: {
  environment: EnvironmentType;
  compact: boolean;
  statusLabel: string;
  locationLabel: string;
}) {
  const isEarth = environment === 'tierra';
  const [twinkleA] = useState(() => new Animated.Value(0));
  const [twinkleB] = useState(() => new Animated.Value(1));
  const [twinkleC] = useState(() => new Animated.Value(0.4));
  const [shootingAnim] = useState(() => new Animated.Value(0));
  const [cloudAnimA] = useState(() => new Animated.Value(0));
  const [cloudAnimB] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleA, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(twinkleA, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleB, {
          toValue: 0,
          duration: 1350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(twinkleB, {
          toValue: 1,
          duration: 1350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const loopC = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleC, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(twinkleC, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(twinkleC, {
          toValue: 0.4,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    loopA.start();
    loopB.start();
    loopC.start();

    if (isEarth) {
      cloudAnimA.setValue(0);
      cloudAnimB.setValue(0);
      const cloudLoopA = Animated.loop(
        Animated.timing(cloudAnimA, {
          toValue: 1,
          duration: 15000,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      const cloudLoopB = Animated.loop(
        Animated.timing(cloudAnimB, {
          toValue: 1,
          duration: 21000,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        })
      );
      cloudLoopA.start();
      cloudLoopB.start();
      return () => {
        loopA.stop();
        loopB.stop();
        loopC.stop();
        cloudLoopA.stop();
        cloudLoopB.stop();
      };
    }

    const shootingLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(shootingAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(shootingAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(2600),
      ])
    );

    shootingLoop.start();

    return () => {
      loopA.stop();
      loopB.stop();
      loopC.stop();
      shootingLoop.stop();
    };
  }, [isEarth, twinkleA, twinkleB, twinkleC, shootingAnim, cloudAnimA, cloudAnimB]);

  const phases = [twinkleA, twinkleB, twinkleC] as const;

  const shootingTranslateX = shootingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 165],
  });
  const shootingTranslateY = shootingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });
  const shootingOpacity = shootingAnim.interpolate({
    inputRange: [0, 0.12, 0.5, 0.85, 1],
    outputRange: [0, 0.9, 1, 0.55, 0],
  });

  const dotScale = twinkleA.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.25],
  });
  const dotOpacity = twinkleA.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {isEarth ? (
        <>
          {/* Nubes flotando suavemente por el cielo de la Tierra */}
          {EARTH_CLOUDS.map((cloud, index) => {
            const driver = cloud.track === 'a' ? cloudAnimA : cloudAnimB;
            const translateX = driver.interpolate({
              inputRange: [0, 1],
              outputRange: [cloud.rangeX[0], cloud.rangeX[1]],
            });
            const opacity = driver.interpolate({
              inputRange: [0, 0.14, 0.84, 1],
              outputRange: [0, cloud.opacity, cloud.opacity, 0],
            });
            return (
              <Animated.View
                key={`cloud-${index}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: cloud.top,
                  width: cloud.width,
                  height: cloud.height,
                  opacity,
                  transform: [{ translateX }],
                }}>
                <Svg width={cloud.width} height={cloud.height} viewBox="0 0 64 24">
                  <Path
                    d="M14 21 H50 C56 21 60 17 60 12.5 C60 8.5 56.5 5.5 52 5.5 C50 2 46 0 41 0 C35.5 0 31 3 29.5 7.5 C27 6 24 5.5 21 6.5 C16.5 7.5 13 11 12.5 15 C9 15.5 6 17.5 6 19.5 C6 20.5 10 21 14 21 Z"
                    fill="#ffffff"
                    fillOpacity={0.92}
                  />
                </Svg>
              </Animated.View>
            );
          })}

          {/* Aves lejanas planeando suavemente */}
          {EARTH_BIRDS.map((bird, index) => {
            const floatY = phases[bird.phase].interpolate({
              inputRange: [0, 1],
              outputRange: [-1.8, 1.8],
            });
            return (
              <Animated.View
                key={`bird-${index}`}
                style={{
                  position: 'absolute',
                  left: bird.left,
                  top: bird.top,
                  opacity: 0.45,
                  transform: [{ translateY: floatY }],
                }}>
                <Svg width={bird.size} height={bird.size * 0.55} viewBox="0 0 20 11">
                  <Path
                    d="M1 8 Q5.5 2 10 7 Q14.5 2 19 8"
                    fill="none"
                    stroke="#0c4a6e"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            );
          })}
        </>
      ) : (
        <>
          {PARKED_STARS.map((star, index) => {
            const anim = phases[star.phase];
            const opacity = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.24, 1],
            });
            const scale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.75, 1.25],
            });

            return (
              <Animated.View
                key={`star-${index}`}
                style={{
                  position: 'absolute',
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size / 2,
                  backgroundColor: star.color,
                  opacity,
                  transform: [{ scale }],
                }}
              />
            );
          })}

          {PARKED_SPARKLES.map((sparkle, index) => {
            const anim = phases[sparkle.phase];
            const opacity = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.24, 1],
            });
            const scale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.65, 1.18],
            });
            const rotate = anim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '18deg'],
            });

            return (
              <Animated.View
                key={`sparkle-${index}`}
                style={{
                  position: 'absolute',
                  left: sparkle.left,
                  top: sparkle.top,
                  width: sparkle.size,
                  height: sparkle.size,
                  opacity,
                  transform: [{ scale }, { rotate }],
                }}>
                <Svg width={sparkle.size} height={sparkle.size} viewBox="0 0 12 12">
                  <Path
                    d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z"
                    fill={sparkle.color}
                  />
                </Svg>
              </Animated.View>
            );
          })}

          <Animated.View
            style={{
              position: 'absolute',
              left: '14%',
              top: '14%',
              opacity: shootingOpacity,
              transform: [
                { translateX: shootingTranslateX },
                { translateY: shootingTranslateY },
                { rotate: '17.5deg' },
              ],
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: 44,
                height: 3,
              }}>
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  borderRadius: 1,
                  backgroundColor: 'rgba(186, 230, 253, 0.75)',
                }}
              />
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: '#ffffff',
                }}
              />
            </View>
          </Animated.View>
        </>
      )}

      <View
        style={{
          position: 'absolute',
          top: compact ? 8 : 10,
          left: compact ? 10 : 12,
          maxWidth: '76%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: compact ? 8 : 10,
          paddingVertical: compact ? 3 : 4,
          borderRadius: 999,
          backgroundColor: 'rgba(6, 11, 25, 0.76)',
          borderWidth: 1,
          borderColor: 'rgba(151, 214, 247, 0.48)',
        }}>
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#38bdf8',
            opacity: dotOpacity,
            transform: [{ scale: dotScale }],
          }}
        />
        <Text
          className="font-mono text-[9px] font-bold uppercase tracking-wider text-sky-200"
          numberOfLines={1}>
          {statusLabel} · {locationLabel}
        </Text>
        <ChevronDown size={11} color="#bae6fd" />
      </View>
    </View>
  );
}

function ParkedSpacecraftBanner({
  environment,
  compact,
  statusLabel,
  locationLabel,
  accessibilityLabel,
  onPress,
  onLayoutWidth,
}: {
  environment: EnvironmentType;
  compact: boolean;
  statusLabel: string;
  locationLabel: string;
  accessibilityLabel: string;
  onPress: () => void;
  onLayoutWidth?: (width: number) => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => onLayoutWidth?.(e.nativeEvent.layout.width)}
      accessibilityLabel={accessibilityLabel}
      style={{
        aspectRatio: BANNER_ASPECT_RATIO,
        backgroundColor: '#060b19',
        borderColor: 'rgba(151, 214, 247, 0.5)',
      }}
      className="relative w-full overflow-hidden rounded-2xl border shadow-md active:opacity-90">
      <SpaceBannerBackdrop environment={environment} />
      <SpaceBannerRocket environment={environment} />
      <ParkedBannerAnimatedOverlay
        environment={environment}
        compact={compact}
        statusLabel={statusLabel}
        locationLabel={locationLabel}
      />
    </Pressable>
  );
}

const LAUNCH_STREAKS = [
  { left: '11%', height: 22, width: 1.5, color: '#bae6fd', phase: 0 },
  { left: '22%', height: 30, width: 2, color: '#7dd3fc', phase: 1 },
  { left: '36%', height: 26, width: 1.5, color: '#ffffff', phase: 2 },
  { left: '48%', height: 34, width: 2.2, color: '#38bdf8', phase: 0 },
  { left: '61%', height: 28, width: 2, color: '#ffffff', phase: 1 },
  { left: '73%', height: 32, width: 2, color: '#bae6fd', phase: 2 },
  { left: '84%', height: 24, width: 1.5, color: '#7dd3fc', phase: 0 },
  { left: '92%', height: 20, width: 1.5, color: '#ffffff', phase: 1 },
] as const;

// Capa compartida de cohete vectorial + flama anclada a las toberas (para despegue y aterrizaje)
function RocketWithPlumeLayer({
  environment,
  rocketX,
  rocketY,
  rocketScale,
  rocketOpacity,
  flameOpacity,
  flameLength,
  flameWidth,
}: {
  environment: EnvironmentType;
  rocketX: number | Animated.AnimatedInterpolation<number>;
  rocketY: number | Animated.AnimatedInterpolation<number>;
  rocketScale: number | Animated.AnimatedInterpolation<number>;
  rocketOpacity: number | Animated.AnimatedInterpolation<number>;
  flameOpacity: number | Animated.AnimatedInterpolation<number>;
  flameLength: number | Animated.AnimatedInterpolation<number>;
  flameWidth: number | Animated.AnimatedInterpolation<number>;
}) {
  const nozzle = ROCKET_NOZZLE_BY_ENV[environment];
  const isHorizontal = Boolean(nozzle.horizontal);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: rocketOpacity,
          transform: [
            { translateX: rocketX },
            { translateY: rocketY },
            { scale: rocketScale },
          ],
        },
      ]}>
      <View
        style={{
          position: 'absolute',
          left: nozzle.left,
          top: nozzle.top,
          width: 0,
          height: 0,
        }}>
        {isHorizontal ? (
          <Animated.View
            style={{
              position: 'absolute',
              right: -4,
              top: -6,
              width: 30,
              height: 12,
              borderRadius: 999,
              backgroundColor: '#fb923c',
              justifyContent: 'center',
              alignItems: 'flex-end',
              opacity: flameOpacity,
              transform: [{ scaleX: flameLength }, { scaleY: flameWidth }],
            }}>
            <View
              style={{
                width: 17,
                height: 5.5,
                marginRight: 2,
                borderRadius: 999,
                backgroundColor: '#fef08a',
              }}
            />
          </Animated.View>
        ) : (
          <Animated.View
            style={{
              position: 'absolute',
              left: -6.5,
              top: -4,
              width: 13,
              height: 28,
              borderRadius: 999,
              backgroundColor: '#fb923c',
              alignItems: 'center',
              opacity: flameOpacity,
              transform: [{ scaleY: flameLength }, { scaleX: flameWidth }],
            }}>
            <View
              style={{
                width: 6,
                height: 16,
                marginTop: 2,
                borderRadius: 999,
                backgroundColor: '#fef08a',
              }}
            />
          </Animated.View>
        )}
      </View>
      <SpaceBannerRocket environment={environment} />
    </Animated.View>
  );
}

// Capa de despegue sobre la tarjeta unificada: ignición lenta en plataforma, despegue rápido y disolución al cosmos
function ParkedTakeoffOverlay({
  environment,
  launchAnim,
  parkedHeight,
  statusLabel,
  locationLabel,
}: {
  environment: EnvironmentType;
  launchAnim: Animated.Value;
  parkedHeight: number;
  statusLabel: string;
  locationLabel: string;
}) {
  const nozzle = ROCKET_NOZZLE_BY_ENV[environment];
  const isHorizontal = Boolean(nozzle.horizontal);

  // Fondo mantiene escala >= 1.022 durante la vibración para no exponer bordes ni esquinas vacías
  const backdropOpacity = launchAnim.interpolate({
    inputRange: [0, 0.52, 0.74, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backdropScale = launchAnim.interpolate({
    inputRange: [0, 0.08, 0.2, 0.56, 0.84, 1],
    outputRange: [1, 1.022, 1.03, 1.048, 1.09, 1.09],
  });
  const shakeX = launchAnim.interpolate({
    inputRange: [0, 0.08, 0.13, 0.18, 0.23, 0.28, 0.34, 0.4, 0.46, 1],
    outputRange: [0, 0, -1.5, 2.2, -2.2, 1.8, -1.2, 0.6, 0, 0],
  });

  const shockScale = launchAnim.interpolate({
    inputRange: [0, 0.1, 0.54, 1],
    outputRange: [0.25, 0.25, 2.8, 2.8],
  });
  const shockOpacity = launchAnim.interpolate({
    inputRange: [0, 0.1, 0.22, 0.48, 0.62, 1],
    outputRange: [0, 0, 0.8, 0.22, 0, 0],
  });

  const glowScale = launchAnim.interpolate({
    inputRange: [0, 0.06, 0.2, 0.52, 0.64, 1],
    outputRange: [0.2, 0.68, 1.25, 1.85, 0.4, 0],
  });
  const glowOpacity = launchAnim.interpolate({
    inputRange: [0, 0.06, 0.2, 0.5, 0.64, 1],
    outputRange: [0, 0.85, 0.95, 0.65, 0, 0],
  });

  // Despegue lento y pesado (0.16..0.56) seguido de aceleración supersónica hacia órbita (0.56..0.85)
  const rocketX = isHorizontal
    ? launchAnim.interpolate({
        inputRange: [0, 0.16, 0.3, 0.44, 0.56, 0.66, 0.76, 0.85, 1],
        outputRange: [0, 0, 7, 18, 36, 92, 190, 310, 310],
      })
    : 0;
  const rocketY = isHorizontal
    ? launchAnim.interpolate({
        inputRange: [0, 0.16, 0.3, 0.44, 0.56, 0.66, 0.76, 0.85, 1],
        outputRange: [0, 0, -2, -6, -13, -38, -88, -150, -150],
      })
    : launchAnim.interpolate({
        inputRange: [0, 0.16, 0.3, 0.44, 0.56, 0.66, 0.76, 0.85, 1],
        outputRange: [0, 0, -5, -14, -28, -68, -145, -245, -245],
      });
  const rocketScale = launchAnim.interpolate({
    inputRange: [0, 0.16, 0.56, 0.82, 1],
    outputRange: [1, 1.015, 1.03, 0.88, 0.82],
  });
  const rocketOpacity = launchAnim.interpolate({
    inputRange: [0, 0.76, 0.85, 1],
    outputRange: [1, 1, 0, 0],
  });

  const flameOpacity = launchAnim.interpolate({
    inputRange: [0, 0.05, 0.16, 0.56, 0.78, 0.85, 1],
    outputRange: [0, 0.75, 0.96, 1, 0.85, 0, 0],
  });
  const flameLength = launchAnim.interpolate({
    inputRange: [0, 0.08, 0.24, 0.56, 0.78, 1],
    outputRange: [0.3, 0.68, 0.95, 1.25, 1.65, 1.65],
  });
  const flameWidth = launchAnim.interpolate({
    inputRange: [0, 0.16, 0.56, 0.8, 1],
    outputRange: [0.65, 0.95, 1.05, 0.85, 0.8],
  });

  const hudOpacity = launchAnim.interpolate({
    inputRange: [0, 0.08, 0.54, 0.7, 1],
    outputRange: [1, 1, 1, 0, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Líneas de velocidad estelares sobre toda la tarjeta cósmica al acelerar a órbita */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {LAUNCH_STREAKS.map((s, idx) => {
          const start = 0.36 + s.phase * 0.07;
          const mid1 = start + 0.08;
          const mid2 = start + 0.34;
          const end = Math.min(0.95, start + 0.48);

          const streakY = launchAnim.interpolate({
            inputRange: [0, start, end, 1],
            outputRange: [-38, -38, 220, 235],
          });
          const streakOpacity = launchAnim.interpolate({
            inputRange: [0, start, mid1, mid2, end, 1],
            outputRange: [0, 0, 0.85, 0.65, 0, 0],
          });

          return (
            <Animated.View
              key={idx}
              style={{
                position: 'absolute',
                left: s.left,
                top: 0,
                width: s.width,
                height: s.height,
                borderRadius: 999,
                backgroundColor: s.color,
                opacity: streakOpacity,
                transform: [{ translateY: streakY }],
              }}
            />
          );
        })}
      </View>

      {/* Escenario del banner con tamaño inicial exacto para que fondo, ignición y cohete coincidan 1:1 */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: parkedHeight,
        }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: backdropOpacity,
              transform: [{ translateX: shakeX }, { scale: backdropScale }],
            },
          ]}>
          <SpaceBannerBackdrop environment={environment} />
        </Animated.View>

        {/* Onda expansiva y brillo de ignición en la plataforma */}
        <View
          style={{
            position: 'absolute',
            left: nozzle.left,
            top: nozzle.top,
            width: 0,
            height: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: '#38bdf8',
              opacity: shockOpacity,
              transform: [{ scale: shockScale }],
            }}
          />
          <Animated.View
            style={{
              position: 'absolute',
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(251, 146, 60, 0.62)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#fef08a',
              }}
            />
          </Animated.View>
        </View>

        {/* El propio cohete del banner despega con su flama adherida a las toberas */}
        <RocketWithPlumeLayer
          environment={environment}
          rocketX={rocketX}
          rocketY={rocketY}
          rocketScale={rocketScale}
          rocketOpacity={rocketOpacity}
          flameOpacity={flameOpacity}
          flameLength={flameLength}
          flameWidth={flameWidth}
        />

        {/* Indicador superior de ignición */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: 'rgba(6, 11, 25, 0.78)',
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.6)',
            opacity: hudOpacity,
          }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#f59e0b',
            }}
          />
          <Text
            className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200"
            numberOfLines={1}>
            {statusLabel} · {locationLabel}
          </Text>
        </Animated.View>
      </View>

      {/* Borde del banner estacionado que se disuelve al entrar la línea de tiempo */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(151, 214, 247, 0.5)',
            opacity: backdropOpacity,
          },
        ]}
      />
    </View>
  );
}

// Reentrada y aterrizaje suave al volver al banner (al llegar antes o cancelar el plan de vuelo)
function ParkedLandingOverlay({
  environment,
  returnAnim,
  parkedHeight,
  compact,
  statusLabel,
  locationLabel,
}: {
  environment: EnvironmentType;
  returnAnim: Animated.Value;
  parkedHeight: number;
  compact: boolean;
  statusLabel: string;
  locationLabel: string;
}) {
  const nozzle = ROCKET_NOZZLE_BY_ENV[environment];
  const isHorizontal = Boolean(nozzle.horizontal);

  const backdropOpacity = returnAnim.interpolate({
    inputRange: [0, 0.3, 0.68, 1],
    outputRange: [0, 0, 1, 1],
  });
  const backdropScale = returnAnim.interpolate({
    inputRange: [0, 0.3, 0.86, 1],
    outputRange: [1.07, 1.07, 1, 1],
  });

  const rocketX = isHorizontal
    ? returnAnim.interpolate({
        inputRange: [0, 0.34, 0.54, 0.72, 0.86, 1],
        outputRange: [210, 210, 88, 20, 0, 0],
      })
    : 0;
  const rocketY = isHorizontal
    ? returnAnim.interpolate({
        inputRange: [0, 0.34, 0.54, 0.72, 0.86, 1],
        outputRange: [-105, -105, -42, -9, 0, 0],
      })
    : returnAnim.interpolate({
        inputRange: [0, 0.34, 0.54, 0.72, 0.86, 1],
        outputRange: [-165, -165, -70, -16, 0, 0],
      });
  const rocketScale = returnAnim.interpolate({
    inputRange: [0, 0.34, 0.72, 0.88, 1],
    outputRange: [0.82, 0.82, 1.02, 1, 1],
  });
  const rocketOpacity = returnAnim.interpolate({
    inputRange: [0, 0.32, 0.44, 1],
    outputRange: [0, 0, 1, 1],
  });

  const flameOpacity = returnAnim.interpolate({
    inputRange: [0, 0.34, 0.48, 0.74, 0.89, 1],
    outputRange: [0, 0, 0.9, 0.62, 0, 0],
  });
  const flameLength = returnAnim.interpolate({
    inputRange: [0, 0.34, 0.52, 0.78, 0.9, 1],
    outputRange: [0.8, 0.8, 1.3, 0.7, 0.25, 0.25],
  });
  const flameWidth = returnAnim.interpolate({
    inputRange: [0, 0.34, 0.52, 0.88, 1],
    outputRange: [0.85, 0.85, 1, 0.65, 0.6],
  });

  const touchScale = returnAnim.interpolate({
    inputRange: [0, 0.76, 0.98, 1],
    outputRange: [0.35, 0.35, 1.9, 1.9],
  });
  const touchOpacity = returnAnim.interpolate({
    inputRange: [0, 0.76, 0.86, 0.98, 1],
    outputRange: [0, 0, 0.7, 0, 0],
  });

  const hudOpacity = returnAnim.interpolate({
    inputRange: [0, 0.64, 0.94, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Estelas cósmicas frenando suavemente al salir de la órbita */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {LAUNCH_STREAKS.map((s, idx) => {
          const start = 0.04 + s.phase * 0.06;
          const mid1 = start + 0.1;
          const mid2 = start + 0.28;
          const end = start + 0.42;

          const streakY = returnAnim.interpolate({
            inputRange: [0, start, end, 1],
            outputRange: [130, 130, -24, -24],
          });
          const streakOpacity = returnAnim.interpolate({
            inputRange: [0, start, mid1, mid2, end, 1],
            outputRange: [0, 0, 0.58, 0.42, 0, 0],
          });

          return (
            <Animated.View
              key={idx}
              style={{
                position: 'absolute',
                left: s.left,
                top: 0,
                width: s.width,
                height: s.height,
                borderRadius: 999,
                backgroundColor: s.color,
                opacity: streakOpacity,
                transform: [{ translateY: streakY }],
              }}
            />
          );
        })}
      </View>

      {/* Escenario destino alineado exactamente a la altura final del banner */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: parkedHeight,
        }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: backdropOpacity,
              transform: [{ scale: backdropScale }],
            },
          ]}>
          <SpaceBannerBackdrop environment={environment} />
        </Animated.View>

        <View
          style={{
            position: 'absolute',
            left: nozzle.left,
            top: nozzle.top,
            width: 0,
            height: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 42,
              height: 42,
              borderRadius: 21,
              borderWidth: 2,
              borderColor: '#7dd3fc',
              opacity: touchOpacity,
              transform: [{ scale: touchScale }],
            }}
          />
        </View>

        <RocketWithPlumeLayer
          environment={environment}
          rocketX={rocketX}
          rocketY={rocketY}
          rocketScale={rocketScale}
          rocketOpacity={rocketOpacity}
          flameOpacity={flameOpacity}
          flameLength={flameLength}
          flameWidth={flameWidth}
        />

        {/* Píldora idéntica a ParkedBannerAnimatedOverlay para enlazar sin salto visual */}
        <Animated.View
          style={{
            position: 'absolute',
            top: compact ? 8 : 10,
            left: compact ? 10 : 12,
            maxWidth: '76%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: compact ? 8 : 10,
            paddingVertical: compact ? 3 : 4,
            borderRadius: 999,
            backgroundColor: 'rgba(6, 11, 25, 0.76)',
            borderWidth: 1,
            borderColor: 'rgba(151, 214, 247, 0.48)',
            opacity: hudOpacity,
          }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#38bdf8',
            }}
          />
          <Text
            className="font-mono text-[9px] font-bold uppercase tracking-wider text-sky-200"
            numberOfLines={1}>
            {statusLabel} · {locationLabel}
          </Text>
          <ChevronDown size={11} color="#bae6fd" />
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(151, 214, 247, 0.5)',
            opacity: backdropOpacity,
          },
        ]}
      />
    </View>
  );
}

// Línea de tiempo curva con fondo espacial (#060b19), origen, destino y navecita animada
export function SpaceJourneyTimeline({
  compact = false,
  onPress,
  previewDay,
  previewOrigin,
  previewDestination,
  previewEnvironment,
  previewDaysUntilDeparture,
  previewTotalDays,
}: {
  compact?: boolean;
  onPress?: () => void;
  previewDay?: number;
  previewOrigin?: SpaceLocation;
  previewDestination?: SpaceLocation;
  previewEnvironment?: EnvironmentType;
  previewDaysUntilDeparture?: number;
  previewTotalDays?: number;
}) {
  const {
    missionDay,
    origin,
    destination,
    environment,
    daysUntilDeparture,
    totalMissionDays,
    flightPlanAccepted,
    missionSetupOpen,
    cancelFlightPlan,
    arriveEarly,
    delayMission,
  } = useMission();
  const { t, locale } = useI18n();
  const [trackWidth, setTrackWidth] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [timelineTargetHeight, setTimelineTargetHeight] = useState(0);
  const [delayPickerOpen, setDelayPickerOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const [progressAnim] = useState(() => new Animated.Value(0));
  const [floatAnim] = useState(() => new Animated.Value(0));
  const [launchAnim] = useState(() => new Animated.Value(0));
  const [returnAnim] = useState(() => new Animated.Value(0));
  const [expandAnim] = useState(() => new Animated.Value(0));

  const activeEnv = previewEnvironment ?? environment;
  const activeOrigin = previewOrigin ?? origin;
  const activeDest = previewDestination ?? destination;
  const activeDay = previewDay ?? missionDay;
  const activeDaysUntil = previewDaysUntilDeparture ?? daysUntilDeparture;

  const envInfo = getEnvironmentText(locale, activeEnv);
  const originInfo = getLocationText(locale, activeOrigin);
  const destInfo = getLocationText(locale, activeDest);
  const routeSpec = getRouteDurationSpec(activeOrigin, activeDest);

  const totalDays = previewTotalDays ?? totalMissionDays;
  const isPreview = previewDay !== undefined || previewOrigin !== undefined;
  const isParked = !isPreview && !flightPlanAccepted;

  const [prevSnapshot, setPrevSnapshot] = useState({
    isParked,
    missionSetupOpen,
    env: activeEnv,
  });
  const [launching, setLaunching] = useState(false);
  const [launchEnv, setLaunchEnv] = useState<EnvironmentType>(activeEnv);
  const [launchKey, setLaunchKey] = useState(0);
  const [returning, setReturning] = useState(false);
  const [landingEnv, setLandingEnv] = useState<EnvironmentType>(activeEnv);
  const [returnHeight, setReturnHeight] = useState(0);
  const [returnKey, setReturnKey] = useState(0);

  if (
    isParked !== prevSnapshot.isParked ||
    missionSetupOpen !== prevSnapshot.missionSetupOpen ||
    activeEnv !== prevSnapshot.env
  ) {
    const startedFromModal =
      !isPreview && prevSnapshot.isParked && prevSnapshot.missionSetupOpen && !isParked;
    const returnedToBanner = !isPreview && !prevSnapshot.isParked && isParked;

    if (startedFromModal) {
      setReturning(false);
      setLaunchEnv(prevSnapshot.env);
      setLaunchKey((k) => k + 1);
      setLaunching(true);
    } else if (returnedToBanner) {
      setLaunching(false);
      setLandingEnv(activeEnv);
      setReturnHeight(timelineTargetHeight);
      setReturnKey((k) => k + 1);
      setReturning(true);
    } else if (isParked && !prevSnapshot.isParked) {
      setLaunching(false);
    }

    setPrevSnapshot({
      isParked,
      missionSetupOpen,
      env: activeEnv,
    });
  }

  const effectiveTrackDay = activeDay;
  const ratio = Math.max(
    0.06,
    Math.min(0.96, totalDays > 0 ? effectiveTrackDay / totalDays : 0.06)
  );
  const totalDaysLabel = formatRouteDays(totalDays);
  const canShowActiveControls =
    !compact && !isPreview && flightPlanAccepted && effectiveTrackDay < totalDays;
  const delayPresets = useMemo(() => getDelayPresetDays(totalDays), [totalDays]);

  useEffect(() => {
    if (!launching) return;
    launchAnim.setValue(0);
    expandAnim.setValue(0);

    const anim = Animated.parallel([
      Animated.timing(launchAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.delay(1040),
        Animated.timing(expandAnim, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]);

    anim.start(({ finished }) => {
      if (!finished) return;
      setLaunching(false);
    });

    return () => anim.stop();
  }, [launching, launchKey, launchAnim, expandAnim]);

  useEffect(() => {
    if (!returning) return;
    returnAnim.setValue(0);
    expandAnim.setValue(1);

    const anim = Animated.parallel([
      Animated.timing(returnAnim, {
        toValue: 1,
        duration: 1320,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.delay(160),
        Animated.timing(expandAnim, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]);

    anim.start(({ finished }) => {
      if (!finished) return;
      setReturning(false);
    });

    return () => anim.stop();
  }, [returning, returnKey, returnAnim, expandAnim]);

  useEffect(() => {
    if (isParked && !launching && !returning) {
      launchAnim.setValue(0);
      returnAnim.setValue(0);
      expandAnim.setValue(0);
      progressAnim.setValue(0.06);
    }
  }, [isParked, launching, returning, launchAnim, returnAnim, expandAnim, progressAnim]);

  useEffect(() => {
    if (isParked || launching || returning) return;
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 750,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [ratio, progressAnim, isParked, launching, returning]);

  useEffect(() => {
    if (isParked || launching || returning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -2.5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(floatAnim, {
          toValue: 2.5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, isParked, launching, returning]);

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

  if (isParked && !launching && !returning) {
    return (
      <>
        <ParkedSpacecraftBanner
          environment={activeEnv}
          compact={compact}
          statusLabel={t('missions.timeline.noActivePlan')}
          locationLabel={envInfo.shortLabel}
          accessibilityLabel={t('missions.selector.changeA11y')}
          onPress={() => setLocationModalOpen(true)}
          onLayoutWidth={(w) => {
            if (w > 0 && Math.abs(w - cardWidth) > 1) {
              setCardWidth(w);
            }
          }}
        />
        <EnvironmentPickerModal
          visible={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
        />
      </>
    );
  }

  const timelineCard = (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && Math.abs(width - cardWidth) > 1) {
          setCardWidth(width);
        }
        if (!returning && height > 0 && Math.abs(height - timelineTargetHeight) > 1) {
          setTimelineTargetHeight(height);
        }
      }}
      style={{ backgroundColor: '#060b19', borderColor: 'rgba(56, 189, 248, 0.25)' }}
      className={`overflow-hidden rounded-2xl border shadow-md ${compact ? 'p-3.5' : 'p-4'}`}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          {!compact && (
            <Text className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-sky-400">
              {activeDaysUntil > 0
                ? t(
                    activeDaysUntil === 1
                      ? 'missions.timeline.takeoffOne'
                      : 'missions.timeline.takeoffMany',
                    { n: activeDaysUntil }
                  )
                : t('missions.timeline.activeInRoute')}
            </Text>
          )}
          <Text className="font-mono text-xs font-bold text-slate-100" numberOfLines={1}>
            {originInfo.shortLabel} → {destInfo.label}
          </Text>
          {routeSpec && (
            <Text className="mt-0.5 font-mono text-[9.5px] text-slate-400">
              {t('missions.plan.route', {
                min: formatRouteDays(routeSpec.minDias),
                max: formatRouteDays(routeSpec.maxDias),
              })}{' '}
              ·{' '}
              {t(
                routeSpec.promedioDias === 1 ? 'missions.plan.avgOne' : 'missions.plan.avgMany',
                { n: formatRouteDays(routeSpec.promedioDias) }
              )}
            </Text>
          )}
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
                <View
                  style={{ backgroundColor: '#060b19', borderColor: '#38bdf8', borderWidth: 1.8 }}
                  className="h-full w-full items-center justify-center overflow-hidden rounded-full shadow-sm">
                  <Image
                    source={require('@/assets/images/Naveee (1).svg')}
                    style={{ width: 22, height: 15 }}
                    contentFit="contain"
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
            {t('missions.timeline.day0', { place: originInfo.shortLabel })}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text className="font-mono text-[9px] text-slate-300">
            {t('missions.timeline.dayAt', { day: totalDaysLabel, place: destInfo.shortLabel })}
          </Text>
          <View className="ml-1.5 h-2 w-2 rounded-full bg-slate-500" />
        </View>
      </View>

      {canShowActiveControls && (
        <View className="mt-3 gap-2">
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setDelayPickerOpen(false);
                arriveEarly();
              }}
              accessibilityLabel={t('missions.timeline.arriveEarlyA11y')}
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.14)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
              }}
              className="flex-1 items-center justify-center rounded-xl border px-2.5 py-2 active:opacity-75">
              <Text
                numberOfLines={1}
                className="font-mono text-[10.5px] font-bold text-sky-200">
                {t('missions.timeline.arriveEarly')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDelayPickerOpen((open) => !open)}
              accessibilityLabel={t('missions.timeline.delayShortA11y')}
              style={{
                backgroundColor: delayPickerOpen
                  ? 'rgba(56, 189, 248, 0.22)'
                  : 'rgba(148, 163, 184, 0.12)',
                borderColor: delayPickerOpen
                  ? 'rgba(56, 189, 248, 0.6)'
                  : 'rgba(148, 163, 184, 0.3)',
              }}
              className="flex-1 flex-row items-center justify-center rounded-xl border px-2.5 py-2 active:opacity-75">
              <ClockPlus size={12} color="#7dd3fc" />
              <Text
                numberOfLines={1}
                className="ml-1.5 font-mono text-[10.5px] font-bold text-slate-200">
                {t('missions.timeline.delayShortQuestion')}
              </Text>
            </Pressable>
          </View>

          {delayPickerOpen && (
            <View
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: 'rgba(56, 189, 248, 0.34)',
              }}
              className="rounded-xl border p-3">
              <View className="mb-2.5 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-mono text-[10.5px] font-bold text-slate-100">
                    {t('missions.plan.delayQuestion')}
                  </Text>
                  <Text className="mt-0.5 font-mono text-[9px] text-slate-400">
                    {t('missions.timeline.delayExtendHint')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDelayPickerOpen(false)}
                  accessibilityLabel={t('missions.timeline.closeDelayA11y')}
                  className="h-6 w-6 items-center justify-center rounded-full bg-slate-800 active:opacity-75">
                  <X size={12} color="#cbd5e1" />
                </Pressable>
              </View>
              <View className="flex-row gap-1.5">
                {delayPresets.map((extra) => (
                  <Pressable
                    key={extra}
                    onPress={() => {
                      delayMission(extra);
                      setDelayPickerOpen(false);
                    }}
                    style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.14)',
                      borderColor: 'rgba(56, 189, 248, 0.4)',
                    }}
                    className="flex-1 items-center rounded-lg border py-2 active:opacity-75">
                    <Text className="font-mono text-[10.5px] font-extrabold text-sky-300">
                      {t('missions.timeline.plusDays', { n: extra })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            onPress={cancelFlightPlan}
            accessibilityLabel={t('missions.selector.cancelPlanA11y')}
            style={{
              backgroundColor: 'rgba(148, 163, 184, 0.12)',
              borderColor: 'rgba(148, 163, 184, 0.3)',
            }}
            className="items-center justify-center rounded-xl border py-2 active:opacity-75">
            <Text className="font-mono text-[10.5px] font-bold text-slate-200">
              {t('missions.selector.cancelPlan')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  if (launching) {
    const parkedHeight = cardWidth > 0 ? cardWidth / BANNER_ASPECT_RATIO : 108;
    const targetHeight = Math.max(parkedHeight, timelineTargetHeight || parkedHeight);
    const animatedHeight = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [parkedHeight, targetHeight],
    });
    const timelineFade = launchAnim.interpolate({
      inputRange: [0, 0.58, 0.9, 1],
      outputRange: [0, 0, 1, 1],
    });
    const timelineScale = launchAnim.interpolate({
      inputRange: [0, 0.58, 0.96, 1],
      outputRange: [0.95, 0.95, 1, 1],
    });
    const timelineSlideY = launchAnim.interpolate({
      inputRange: [0, 0.58, 0.96, 1],
      outputRange: [12, 12, 0, 0],
    });
    const launchEnvInfo = getEnvironmentText(locale, launchEnv);

    return (
      <Animated.View
        style={{
          height: animatedHeight,
          backgroundColor: '#060b19',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            opacity: timelineFade,
            transform: [{ translateY: timelineSlideY }, { scale: timelineScale }],
          }}>
          {timelineCard}
        </Animated.View>
        <ParkedTakeoffOverlay
          environment={launchEnv}
          launchAnim={launchAnim}
          parkedHeight={parkedHeight}
          statusLabel={t('missions.timeline.launching')}
          locationLabel={launchEnvInfo.shortLabel}
        />
      </Animated.View>
    );
  }

  if (returning) {
    const parkedHeight = cardWidth > 0 ? cardWidth / BANNER_ASPECT_RATIO : 108;
    const startHeight = Math.max(parkedHeight, returnHeight || parkedHeight);
    const animatedHeight = expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [parkedHeight, startHeight],
    });
    const timelineFadeOut = returnAnim.interpolate({
      inputRange: [0, 0.34, 1],
      outputRange: [1, 0, 0],
    });
    const timelineScaleOut = returnAnim.interpolate({
      inputRange: [0, 0.36, 1],
      outputRange: [1, 0.94, 0.94],
    });
    const timelineSlideOut = returnAnim.interpolate({
      inputRange: [0, 0.36, 1],
      outputRange: [0, 10, 10],
    });
    const landingEnvInfo = getEnvironmentText(locale, landingEnv);

    return (
      <Animated.View
        style={{
          height: animatedHeight,
          backgroundColor: '#060b19',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            opacity: timelineFadeOut,
            transform: [{ translateY: timelineSlideOut }, { scale: timelineScaleOut }],
          }}>
          {timelineCard}
        </Animated.View>
        <ParkedLandingOverlay
          environment={landingEnv}
          returnAnim={returnAnim}
          parkedHeight={parkedHeight}
          compact={compact}
          statusLabel={t('missions.timeline.noActivePlan')}
          locationLabel={landingEnvInfo.shortLabel}
        />
      </Animated.View>
    );
  }

  if (onPress && !canShowActiveControls) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={t('vital.missions.a11y')}
        className="active:opacity-90">
        {timelineCard}
      </Pressable>
    );
  }

  return timelineCard;
}
