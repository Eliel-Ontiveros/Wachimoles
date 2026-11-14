import { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';

interface StartupSplashAnimationProps {
  onComplete: () => void;
}

export function StartupSplashAnimation({ onComplete }: StartupSplashAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let completed = false;
    let anim: AnimationItem | null = null;
    let finishTimer: number | null = null;
    const fetchController = new AbortController();

    const triggerComplete = () => {
      if (cancelled || completed) return;
      completed = true;
      onCompleteRef.current();
    };

    const safetyTimer = window.setTimeout(() => {
      triggerComplete();
    }, 6500);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const jsonUrl = `${import.meta.env.BASE_URL}animations/logo_nave_orbita_v3.json`;

    const startAnimation = async () => {
      try {
        const [lottieModule, animationData] = await Promise.all([
          import('lottie-web'),
          fetch(jsonUrl, { signal: fetchController.signal }).then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} loading splash animation`);
            }
            return res.json();
          }),
        ]);

        if (cancelled || !containerRef.current) return;

        const lottie = lottieModule.default ?? lottieModule;
        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: !prefersReducedMotion,
          animationData,
          rendererSettings: {
            preserveAspectRatio: 'xMidYMid meet',
          },
        });

        const holdLastFrame = () => {
          if (!anim) return;
          const lastFrame = Math.max(0, anim.totalFrames - 1);
          anim.goToAndStop(lastFrame, true);
        };

        if (prefersReducedMotion) {
          const handleReducedLoaded = () => {
            if (cancelled) return;
            holdLastFrame();
            finishTimer = window.setTimeout(triggerComplete, 350);
          };

          if (anim.isLoaded && anim.totalFrames > 0) {
            handleReducedLoaded();
          } else {
            anim.addEventListener('DOMLoaded', handleReducedLoaded);
          }
        } else {
          anim.addEventListener('complete', () => {
            if (cancelled) return;
            holdLastFrame();
            finishTimer = window.setTimeout(triggerComplete, 200);
          });
        }
      } catch {
        triggerComplete();
      }
    };

    void startAnimation();

    return () => {
      cancelled = true;
      fetchController.abort();
      window.clearTimeout(safetyTimer);
      if (finishTimer !== null) {
        window.clearTimeout(finishTimer);
      }
      anim?.destroy();
    };
  }, []);

  return (
    <div
      className="startup-splash-screen"
      role="status"
      aria-label="Cargando aplicación TraumaTeam"
    >
      <div ref={containerRef} className="startup-splash-lottie-stage" />
    </div>
  );
}
