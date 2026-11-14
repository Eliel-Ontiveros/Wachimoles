import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import type { AnimationItem, LottiePlayer } from 'lottie-web';

interface StartupSplashAnimationProps {
  onComplete: () => void;
}

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const DISSOLVE_DURATION_MS = 420;

let NativeWebView: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeWebView = require('react-native-webview').WebView;
  } catch {
    NativeWebView = null;
  }
}

const TRAUMATEAM_WORDMARK_PATHS: readonly { d: string; fill: string }[] = [
  // Trauma (#313643)
  { fill: '#313643', d: 'M0,0h26.45v4.06h-10.71v23.58h-4.86V4.06H0V0Z' },
  {
    fill: '#313643',
    d: 'M31.52,15.12q0-2.7,1.92-4.61t4.61-1.92h16.19v3.5h-14.24q-1.41,0-2.42,1-1,.99-1,2.42v12.13h-5.06V15.12Z',
  },
  {
    fill: '#313643',
    d: 'M84.67,21.72q-.02,2.69-1.8,4.32t-4.78,1.6h-15.12q-2.95,0-4.77-1.55-1.81-1.56-1.81-4.1v-.27q0-2.54,1.81-4.1,1.82-1.57,4.77-1.57h13.16q1.96,0,3.48.75v-1.53q0-1.19-1-2.15-1.05-1.03-2.48-1.03h-17.58v-3.5h19.54q2.67,0,4.62,1.88,1.96,1.85,1.96,4.41V21.72ZM76.13,24.36q3.48,0,3.48-2.66,0-1.29-1.35-1.93-.88-.41-2.13-.41h-11.21q-1.27,0-2.13.41-1.34.64-1.34,1.95v.27q0,1.31,1.34,1.96.88.41,2.13.41H76.13Z',
  },
  {
    fill: '#313643',
    d: 'M112.4,8.59h5.04v12.52q0,2.7-1.91,4.61t-4.61,1.92h-15.24q-2.69,0-4.61-1.92-1.91-1.91-1.91-4.61v-12.52h5.06v12.13q0,1.43.99,2.42,1.02,1.02,2.43,1.02h11.32q1.43,0,2.43-1.02,1.01-.99,1.01-2.42V8.59Z',
  },
  {
    fill: '#313643',
    d: 'M158.81,8.59q2.71,0,4.65,1.92t1.93,4.67v12.46h-5.06v-12.07q0-1.45-1.01-2.46-1.02-1.04-2.46-1.04h-6.9q-1.44,0-2.46,1.02-1.02,1.03-1.02,2.46v12.09h-5.05v-12.07q0-1.45-1.02-2.48-1.01-1.02-2.46-1.02h-5.65q-1.95,0-3.34,1.39-1.38,1.38-1.38,3.36v10.82h-5.06v-11.6h.02q.14-3.13,2.4-5.28,2.29-2.17,5.41-2.17h8.58q3.04,0,5.02,2.35,1.99-2.35,5.03-2.35H158.81Z',
  },
  {
    fill: '#313643',
    d: 'M198.16,21.72q-.01,2.69-1.79,4.32t-4.79,1.6h-15.12q-2.94,0-4.76-1.55-1.82-1.56-1.82-4.1v-.27q0-2.54,1.82-4.1,1.82-1.57,4.76-1.57h13.17q1.95,0,3.48.75v-1.53q0-1.19-1-2.15-1.06-1.03-2.48-1.03h-17.58v-3.5h19.53q2.68,0,4.63,1.88,1.95,1.85,1.95,4.41V21.72ZM189.63,24.36q3.47,0,3.48-2.66,0-1.29-1.35-1.93-.88-.41-2.13-.41h-11.21q-1.27,0-2.13.41-1.35.64-1.35,1.95v.27q0,1.31,1.35,1.96.88.41,2.13.41H189.63Z',
  },
  // Team (#616470)
  { fill: '#616470', d: 'M202.66,0h26.44v3.09h-11.68v24.55h-3.1V3.09h-11.66V0Z' },
  {
    fill: '#616470',
    d: 'M254.61,8.59q3.24,0,5.55,2.31t2.3,5.53v2.57h-25.19v2.05q0,1.45,1.03,2.47,1.02,1.03,2.46,1.03h21.68v3.09h-21.68q-2.73,0-4.67-1.94-1.91-1.91-1.91-4.65v-5.87q0-2.72,1.91-4.65,1.94-1.94,4.67-1.94H254.61ZM259.32,15.9q-.2-1.78-1.55-2.99-1.34-1.21-3.16-1.21h-13.85q-1.44,0-2.46,1.01-1.03,1.02-1.03,2.47v.72H259.32Z',
  },
  {
    fill: '#616470',
    d: 'M295.23,21.72q-.01,2.69-1.79,4.32t-4.79,1.6h-15.11q-2.95,0-4.77-1.55-1.82-1.56-1.82-4.1v-.27q0-2.54,1.82-4.1,1.82-1.57,4.77-1.57h15.11q1.95,0,3.48.75v-1.92q0-1.19-1-2.15-1.05-1.03-2.48-1.03h-19.53v-3.11h19.53q2.68,0,4.63,1.88,1.95,1.85,1.95,4.41V21.72ZM288.65,24.55q3.48,0,3.48-2.85,0-1.48-1.35-2.13-.88-.41-2.13-.41h-15.11q-1.27,0-2.13.41-1.35.64-1.35,2.15v.27q0,1.51,1.35,2.15.88.41,2.13.41H288.65Z',
  },
  {
    fill: '#616470',
    d: 'M336.02,8.59q2.71,0,4.64,1.92t1.94,4.67v12.46h-3.11v-12.46q0-1.45-1.01-2.47-1.02-1.03-2.46-1.03h-9.83q-1.44,0-2.46,1.02-1.01,1.03-1.02,2.46v12.48h-3.1v-12.46q0-1.45-1.02-2.48-1.01-1.02-2.46-1.02h-8.57q-1.95,0-3.34,1.39-1.39,1.38-1.39,3.36v11.21h-3.1v-11.6h.02q.13-3.13,2.4-5.28,2.28-2.17,5.41-2.17h8.57q3.05,0,5.02,2.35,1.99-2.35,5.04-2.35H336.02Z',
  },
];

function buildSplashHtml(animationJson: string, reduceMotion: boolean): string {
  const wordmarkPathsHtml = TRAUMATEAM_WORDMARK_PATHS.map(
    (item, idx) =>
      `<path class="wordmark-letter" style="--idx:${idx}" fill="${item.fill}" d="${item.d}"/>`
  ).join('');

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
    .lockup {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 680px;
      padding: 0 8px;
    }
    #lottie-stage {
      flex: 0 0 auto;
      width: clamp(96px, 28vw, 220px);
      aspect-ratio: 1596 / 1110;
      background: transparent;
      transform: translateX(clamp(34px, 12vw, 95px));
      transition: transform 0.72s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .lockup.is-wordmark-visible #lottie-stage {
      transform: translateX(0);
    }
    .wordmark {
      display: block;
      flex: 0 0 auto;
      width: clamp(148px, 46vw, 360px);
      height: auto;
      margin-left: clamp(-20px, -2.5vw, -8px);
      overflow: visible;
    }
    .wordmark-letter {
      opacity: 0;
      transform: translate3d(-12px, 3px, 0) scale(0.94);
      transform-box: fill-box;
      transform-origin: center;
      transition:
        opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--idx, 0) * 48ms + 120ms);
    }
    .lockup.is-wordmark-visible .wordmark-letter {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
    @media (prefers-reduced-motion: reduce) {
      #lottie-stage,
      .wordmark-letter {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <div id="lockup" class="lockup${reduceMotion ? ' is-wordmark-visible' : ''}">
    <div id="lottie-stage"></div>
    <svg class="wordmark" viewBox="0 0 342.6 27.64" aria-label="TraumaTeam">${wordmarkPathsHtml}</svg>
  </div>
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
      var lockup = document.getElementById('lockup');
      var prefersReduced = window.__REDUCE_MOTION ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      var wordmarkTimer = null;
      function showWordmark() {
        if (lockup) lockup.classList.add('is-wordmark-visible');
      }
      function scheduleWordmark() {
        if (wordmarkTimer !== null) return;
        wordmarkTimer = setTimeout(showWordmark, 1450);
      }

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
          showWordmark();
          setTimeout(notifyComplete, 1000);
        };
        if (anim.isLoaded && anim.totalFrames > 0) {
          onReady();
        } else {
          anim.addEventListener('DOMLoaded', onReady);
        }
      } else {
        if (anim.isLoaded && anim.totalFrames > 0) {
          scheduleWordmark();
        } else {
          anim.addEventListener('DOMLoaded', scheduleWordmark);
        }
        anim.addEventListener('complete', function () {
          holdFinalFrame();
          showWordmark();
          notifyComplete();
        });
      }
    })();
  </script>
</body>
</html>`;
}

export function StartupSplashAnimation({ onComplete }: StartupSplashAnimationProps) {
  const webContainerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const startExitRef = useRef<(reduceMotion: boolean) => void>(() => {});
  const hasCompletedRef = useRef(false);
  const [isDissolving, setIsDissolving] = useState(false);
  const [wordmarkVisible, setWordmarkVisible] = useState(false);
  const [dissolveProgress] = useState(() => new Animated.Value(0));
  const [nativeHtml, setNativeHtml] = useState<string | null>(null);
  const [reduceMotionPref, setReduceMotionPref] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let dissolvingStarted = false;
    let anim: AnimationItem | null = null;
    let wordmarkTimer: ReturnType<typeof setTimeout> | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerComplete = () => {
      if (cancelled || hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      onCompleteRef.current();
    };

    const safetyTimer = setTimeout(triggerComplete, 7500);

    const scheduleWordmarkReveal = () => {
      if (cancelled || wordmarkTimer !== null) return;
      wordmarkTimer = setTimeout(() => {
        if (!cancelled) {
          setWordmarkVisible(true);
        }
      }, 1450);
    };

    const beginHexDissolve = (reduceMotion: boolean) => {
      if (cancelled || hasCompletedRef.current || dissolvingStarted) return;
      dissolvingStarted = true;
      clearTimeout(safetyTimer);

      if (reduceMotion) {
        finishTimer = setTimeout(triggerComplete, 1000);
        return;
      }

      holdTimer = setTimeout(() => {
        if (cancelled || hasCompletedRef.current) return;
        setIsDissolving(true);
        finishTimer = setTimeout(triggerComplete, DISSOLVE_DURATION_MS + 60);
        Animated.timing(dissolveProgress, {
          toValue: 1,
          duration: DISSOLVE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(({ finished }) => {
          if (finished) {
            triggerComplete();
          }
        });
      }, 1000);
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
              setWordmarkVisible(true);
              beginHexDissolve(true);
            };
            if (anim.isLoaded && anim.totalFrames > 0) {
              onReady();
            } else {
              anim.addEventListener('DOMLoaded', onReady);
            }
          } else {
            if (anim.isLoaded && anim.totalFrames > 0) {
              scheduleWordmarkReveal();
            } else {
              anim.addEventListener('DOMLoaded', scheduleWordmarkReveal);
            }
            anim.addEventListener('complete', () => {
              if (cancelled) return;
              holdFinalFrame();
              setWordmarkVisible(true);
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
      if (wordmarkTimer !== null) {
        clearTimeout(wordmarkTimer);
      }
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
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stageOpacity = dissolveProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const stageScale = dissolveProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={styles.overlay}
      pointerEvents={isDissolving ? 'none' : 'auto'}
      accessibilityLabel="Cargando aplicación TraumaTeam">
      {/* Fondo sólido continuo que se desvanece suavemente tras 1s de pausa */}
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
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '680px',
            }}>
            <div
              ref={webContainerRef}
              style={{
                flex: '0 0 auto',
                width: 'clamp(96px, 28vw, 220px)',
                aspectRatio: '1596 / 1110',
                background: 'transparent',
                transform: wordmarkVisible
                  ? 'translateX(0)'
                  : 'translateX(clamp(34px, 12vw, 95px))',
                transition: reduceMotionPref
                  ? 'none'
                  : 'transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            <svg
              viewBox="0 0 342.6 27.64"
              aria-label="TraumaTeam"
              style={{
                display: 'block',
                flex: '0 0 auto',
                width: 'clamp(148px, 46vw, 360px)',
                height: 'auto',
                marginLeft: 'clamp(-20px, -2.5vw, -8px)',
                overflow: 'visible',
              }}>
              {TRAUMATEAM_WORDMARK_PATHS.map((item, idx) => (
                <path
                  key={idx}
                  fill={item.fill}
                  d={item.d}
                  style={{
                    opacity: wordmarkVisible ? 1 : 0,
                    transform: wordmarkVisible
                      ? 'translate3d(0, 0, 0) scale(1)'
                      : 'translate3d(-12px, 3px, 0) scale(0.94)',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transition: reduceMotionPref
                      ? 'none'
                      : 'opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
                    transitionDelay: reduceMotionPref ? '0ms' : `${idx * 48 + 120}ms`,
                  }}
                />
              ))}
            </svg>
          </div>
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
    paddingHorizontal: 16,
    overflow: 'hidden',
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
    maxWidth: 680,
    aspectRatio: 2.45,
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
