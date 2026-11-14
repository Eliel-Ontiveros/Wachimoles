import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { AnimationItem, LottiePlayer } from 'lottie-web';

interface StartupSplashAnimationProps {
  onComplete: () => void;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const DISSOLVE_DURATION_MS = 960;

interface SplashTile {
  key: string;
  cx: number;
  cy: number;
  d: number;
}

interface HexGrid {
  boxW: number;
  boxH: number;
  tilePoints: string;
  tiles: SplashTile[];
}

function hexPoints(radius: number, cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function buildHexGrid(w: number, h: number): HexGrid {
  const safeW = Math.max(320, w);
  const safeH = Math.max(320, h);
  const ox = safeW / 2;
  const oy = safeH / 2;
  const radius = Math.max(40, Math.min(70, Math.round(Math.hypot(safeW, safeH) / 26)));
  const hexW = Math.sqrt(3) * radius;
  const rowStep = 1.5 * radius;
  const boxW = hexW + 4;
  const boxH = 2 * radius + 4;
  const tilePoints = hexPoints(radius + 2.2, boxW / 2, boxH / 2);

  const rows = Math.ceil(safeH / rowStep) + 1;
  const cols = Math.ceil(safeW / hexW) + 1;
  const maxD = Math.max(1, Math.hypot(Math.max(ox, safeW - ox), Math.max(oy, safeH - oy)));

  const tiles: SplashTile[] = [];
  for (let r = -1; r <= rows; r++) {
    const offset = Math.abs(r) % 2 === 1 ? hexW / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const cx = c * hexW + offset;
      const cy = r * rowStep;
      if (cx - hexW / 2 > safeW || cx + hexW / 2 < 0 || cy - radius > safeH || cy + radius < 0) {
        continue;
      }
      tiles.push({
        key: `${r}-${c}`,
        cx,
        cy,
        d: Math.min(1, Math.hypot(cx - ox, cy - oy) / maxD),
      });
    }
  }

  return { boxW, boxH, tilePoints, tiles };
}

const SplashHexTile = memo(function SplashHexTile({
  tile,
  boxW,
  boxH,
  tilePoints,
  dissolveProgress,
}: {
  tile: SplashTile;
  boxW: number;
  boxH: number;
  tilePoints: string;
  dissolveProgress: Animated.Value;
}) {
  const start = tile.d * 0.48;
  const end = Math.min(1, start + 0.52);
  const mid = start + (end - start) * 0.45;

  const scale = dissolveProgress.interpolate({
    inputRange: [start, mid, end],
    outputRange: [1, 0.72, 0],
    extrapolate: 'clamp',
  });
  const rotate = dissolveProgress.interpolate({
    inputRange: [start, mid, end],
    outputRange: ['0deg', '-18deg', '-60deg'],
    extrapolate: 'clamp',
  });
  const opacity = dissolveProgress.interpolate({
    inputRange: [start, Math.min(end, start + 0.08), end],
    outputRange: [1, 0.96, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: tile.cx - boxW / 2,
        top: tile.cy - boxH / 2,
        width: boxW,
        height: boxH,
        opacity,
        transform: [{ scale }, { rotate }],
      }}>
      <Svg width={boxW} height={boxH}>
        <Polygon
          points={tilePoints}
          fill="#f8fafc"
          stroke="#e2e8f0"
          strokeWidth={1.5}
        />
      </Svg>
    </Animated.View>
  );
});

let NativeWebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeWebView = require('react-native-webview').WebView;
  } catch {
    NativeWebView = null;
  }
}

function buildSplashHtml(animationJson: string, reduceMotion: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    #lottie-stage {
      width: 100%;
      max-width: 400px;
      aspect-ratio: 1596 / 1110;
      background: transparent;
    }
  </style>
</head>
<body>
  <div id="lottie-stage"></div>
  <script>
    window.__SPLASH_ANIMATION_DATA = ${animationJson};
    window.__REDUCE_MOTION = ${reduceMotion ? 'true' : 'false'};
    function notifyComplete() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SPLASH_COMPLETE' }));
      }
    }
    window.addEventListener('error', notifyComplete);
  </script>
  <script
    src="https://cdn.jsdelivr.net/npm/lottie-web@5.13.0/build/player/lottie.min.js"
    onerror="notifyComplete()"
  ></script>
  <script>
    (function () {
      if (!window.lottie || !window.__SPLASH_ANIMATION_DATA) {
        notifyComplete();
        return;
      }
      var container = document.getElementById('lottie-stage');
      var prefersReduced = window.__REDUCE_MOTION ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      var anim = window.lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: false,
        autoplay: !prefersReduced,
        animationData: window.__SPLASH_ANIMATION_DATA,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
      });

      function holdFinalFrame() {
        var lastFrame = Math.max(0, anim.totalFrames - 1);
        anim.goToAndStop(lastFrame, true);
      }

      if (prefersReduced) {
        var onReady = function () {
          holdFinalFrame();
          setTimeout(notifyComplete, 350);
        };
        if (anim.isLoaded && anim.totalFrames > 0) {
          onReady();
        } else {
          anim.addEventListener('DOMLoaded', onReady);
        }
      } else {
        anim.addEventListener('complete', function () {
          holdFinalFrame();
          notifyComplete();
        });
      }
    })();
  </script>
</body>
</html>`;
}

export function StartupSplashAnimation({ onComplete }: StartupSplashAnimationProps) {
  const { width, height } = useWindowDimensions();
  const webContainerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const startExitRef = useRef<(reduceMotion: boolean) => void>(() => {});
  const hasCompletedRef = useRef(false);
  const [isDissolving, setIsDissolving] = useState(false);
  const [dissolveProgress] = useState(() => new Animated.Value(0));
  const [nativeHtml, setNativeHtml] = useState<string | null>(null);
  const [reduceMotionPref, setReduceMotionPref] = useState(false);

  const hexGrid = useMemo(() => buildHexGrid(width, height), [width, height]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let dissolvingStarted = false;
    let anim: AnimationItem | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerComplete = () => {
      if (cancelled || hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      onCompleteRef.current();
    };

    const safetyTimer = setTimeout(triggerComplete, 6500);

    const beginHexDissolve = (reduceMotion: boolean) => {
      if (cancelled || hasCompletedRef.current || dissolvingStarted) return;
      dissolvingStarted = true;
      clearTimeout(safetyTimer);

      if (reduceMotion) {
        finishTimer = setTimeout(triggerComplete, 350);
        return;
      }

      holdTimer = setTimeout(() => {
        if (cancelled || hasCompletedRef.current) return;
        setIsDissolving(true);
        finishTimer = setTimeout(triggerComplete, DISSOLVE_DURATION_MS + 60);
        Animated.timing(dissolveProgress, {
          toValue: 1,
          duration: DISSOLVE_DURATION_MS,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(({ finished }) => {
          if (finished) {
            triggerComplete();
          }
        });
      }, 150);
    };

    startExitRef.current = beginHexDissolve;

    const runSplash = async () => {
      try {
        const nativeReduced = await AccessibilityInfo.isReduceMotionEnabled().catch(
          () => false
        );
        const webReduced =
          typeof window !== 'undefined' &&
          Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        const prefersReduced = nativeReduced || webReduced;
        if (!cancelled) {
          setReduceMotionPref(prefersReduced);
        }

        const jsonModule = await import('../../../assets/images/logo_nave_orbita_v5.json');
        if (cancelled) return;
        const rawData = jsonModule.default ?? jsonModule;

        if (Platform.OS === 'web') {
          const lottieModule = await import('lottie-web');
          if (cancelled || !webContainerRef.current) return;

          const candidate = (lottieModule.default ?? lottieModule) as LottiePlayer & {
            default?: LottiePlayer;
          };
          const lottie: LottiePlayer | undefined =
            typeof candidate.loadAnimation === 'function' ? candidate : candidate.default;
          if (!lottie || typeof lottie.loadAnimation !== 'function') {
            throw new Error('Lottie player unavailable');
          }

          const animationData = JSON.parse(JSON.stringify(rawData)) as Record<string, unknown>;
          webContainerRef.current.innerHTML = '';
          anim = lottie.loadAnimation({
            container: webContainerRef.current,
            renderer: 'svg',
            loop: false,
            autoplay: !prefersReduced,
            animationData,
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid meet',
            },
          });

          const holdFinalFrame = () => {
            if (!anim) return;
            const lastFrame = Math.max(0, anim.totalFrames - 1);
            anim.goToAndStop(lastFrame, true);
          };

          if (prefersReduced) {
            const onReady = () => {
              if (cancelled) return;
              holdFinalFrame();
              beginHexDissolve(true);
            };
            if (anim.isLoaded && anim.totalFrames > 0) {
              onReady();
            } else {
              anim.addEventListener('DOMLoaded', onReady);
            }
          } else {
            anim.addEventListener('complete', () => {
              if (cancelled) return;
              holdFinalFrame();
              beginHexDissolve(false);
            });
          }
          return;
        }

        if (!NativeWebView) {
          beginHexDissolve(true);
          return;
        }
        setNativeHtml(buildSplashHtml(JSON.stringify(rawData), prefersReduced));
      } catch {
        triggerComplete();
      }
    };

    void runSplash();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
      }
      if (finishTimer !== null) {
        clearTimeout(finishTimer);
      }
      anim?.destroy();
    };
  }, [dissolveProgress]);

  const handleNativeMessage = (event: { nativeEvent?: { data?: string } }) => {
    try {
      const payload = JSON.parse(event?.nativeEvent?.data ?? '{}');
      if (payload?.type === 'SPLASH_COMPLETE') {
        startExitRef.current(reduceMotionPref);
      }
    } catch {
      // Ignorar mensajes externos
    }
  };

  const solidBgOpacity = dissolveProgress.interpolate({
    inputRange: [0, 0.19],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stageOpacity = dissolveProgress.interpolate({
    inputRange: [0, 0.36],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stageScale = dissolveProgress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.overlay}
      pointerEvents={isDissolving ? 'none' : 'auto'}
      accessibilityLabel="Cargando aplicación TraumaTeam">
      {/* Malla de hexágonos que se disuelve radialmente para revelar la app */}
      <View style={styles.hexLayer} pointerEvents="none">
        {hexGrid.tiles.map((tile) => (
          <SplashHexTile
            key={tile.key}
            tile={tile}
            boxW={hexGrid.boxW}
            boxH={hexGrid.boxH}
            tilePoints={hexGrid.tilePoints}
            dissolveProgress={dissolveProgress}
          />
        ))}
      </View>

      {/* Fondo sólido continuo durante Lottie que cede suavemente al mosaico hexagonal */}
      <Animated.View
        pointerEvents="none"
        style={[styles.solidBg, { opacity: solidBgOpacity }]}
      />

      {/* Escenario de animación Lottie */}
      <Animated.View
        style={[
          styles.stageContainer,
          { opacity: stageOpacity, transform: [{ scale: stageScale }] },
        ]}>
        {Platform.OS === 'web' ? (
          <div
            ref={webContainerRef}
            style={{
              width: '100%',
              maxWidth: '400px',
              aspectRatio: '1596 / 1110',
              background: 'transparent',
            }}
          />
        ) : NativeWebView && nativeHtml ? (
          <NativeWebView
            originWhitelist={['*']}
            source={{ html: nativeHtml }}
            style={styles.nativeWebView}
            containerStyle={styles.nativeWebViewContainer}
            onMessage={handleNativeMessage}
            scrollEnabled={false}
            bounces={false}
            javaScriptEnabled={true}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  hexLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  solidBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    backgroundColor: '#f8fafc',
  },
  stageContainer: {
    zIndex: 3,
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1596 / 1110,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeWebViewContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  nativeWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
