import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import type { AnimationItem } from 'lottie-web';

interface StartupSplashAnimationProps {
  onComplete: () => void;
}

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
          setTimeout(notifyComplete, 200);
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
  const hasCompletedRef = useRef(false);
  const [nativeHtml, setNativeHtml] = useState<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let cancelled = false;
    let anim: AnimationItem | null = null;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerComplete = () => {
      if (cancelled || hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      onCompleteRef.current();
    };

    const safetyTimer = setTimeout(triggerComplete, 6500);

    const runSplash = async () => {
      try {
        const nativeReduced = await AccessibilityInfo.isReduceMotionEnabled().catch(
          () => false
        );
        const webReduced =
          typeof window !== 'undefined' &&
          Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        const prefersReduced = nativeReduced || webReduced;

        if (Platform.OS === 'web') {
          const loadJsonFromPublic = async (): Promise<unknown> => {
            try {
              const res = await fetch('/animations/logo_nave_orbita_v3.json');
              if (res.ok) {
                return await res.json();
              }
            } catch {
              // Fallback a carga diferida desde assets locales si /animations aún no está servido
            }
            const localJson = await import('../../../assets/images/logo_nave_orbita_v3.json');
            return localJson.default ?? localJson;
          };

          const [lottieModule, animationData] = await Promise.all([
            import('lottie-web'),
            loadJsonFromPublic(),
          ]);

          if (cancelled || !webContainerRef.current) return;

          const lottie = lottieModule.default ?? lottieModule;
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
              finishTimer = setTimeout(triggerComplete, 350);
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
              finishTimer = setTimeout(triggerComplete, 200);
            });
          }
          return;
        }

        const jsonModule = await import('../../../assets/images/logo_nave_orbita_v3.json');
        if (cancelled) return;
        const animationData = jsonModule.default ?? jsonModule;
        if (!NativeWebView) {
          finishTimer = setTimeout(triggerComplete, 350);
          return;
        }
        setNativeHtml(buildSplashHtml(JSON.stringify(animationData), prefersReduced));
      } catch {
        triggerComplete();
      }
    };

    void runSplash();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      if (finishTimer !== null) {
        clearTimeout(finishTimer);
      }
      anim?.destroy();
    };
  }, []);

  const handleNativeMessage = (event: { nativeEvent?: { data?: string } }) => {
    try {
      const payload = JSON.parse(event?.nativeEvent?.data ?? '{}');
      if (payload?.type === 'SPLASH_COMPLETE' && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current();
      }
    } catch {
      // Ignorar mensajes externos
    }
  };

  return (
    <View style={styles.overlay} accessibilityLabel="Cargando aplicación TraumaTeam">
      <View style={styles.stageContainer}>
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
      </View>
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
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stageContainer: {
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
