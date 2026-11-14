import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AnimationItem, LottiePlayer } from 'lottie-web';

interface StartupSplashAnimationProps {
  onComplete: () => void;
}

interface HexTile {
  key: string;
  points: string;
  d: number;
}

function hexPoints(radius: number, cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function buildHexTiles(w: number, h: number, ox: number, oy: number): HexTile[] {
  const safeW = Math.max(320, w);
  const safeH = Math.max(320, h);
  const radius = Math.max(44, Math.min(70, Math.round(Math.hypot(safeW, safeH) / 28)));
  const hexW = Math.sqrt(3) * radius;
  const rowStep = 1.5 * radius;
  const drawRadius = radius + 2.2;
  const rows = Math.ceil(safeH / rowStep) + 1;
  const cols = Math.ceil(safeW / hexW) + 1;
  const maxD = Math.max(1, Math.hypot(Math.max(ox, safeW - ox), Math.max(oy, safeH - oy)));

  const tiles: HexTile[] = [];
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
        points: hexPoints(drawRadius, cx, cy),
        d: Math.min(1, Math.hypot(cx - ox, cy - oy) / maxD),
      });
    }
  }
  return tiles;
}

export function StartupSplashAnimation({ onComplete }: StartupSplashAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [isDissolving, setIsDissolving] = useState(false);
  const [wordmarkVisible, setWordmarkVisible] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tiles = useMemo(
    () => buildHexTiles(viewport.width, viewport.height, viewport.width / 2, viewport.height / 2),
    [viewport.width, viewport.height]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let completed = false;
    let anim: AnimationItem | null = null;
    let wordmarkTimer: number | null = null;
    let holdTimer: number | null = null;
    let finishTimer: number | null = null;

    const triggerComplete = () => {
      if (cancelled || completed) return;
      completed = true;
      onCompleteRef.current();
    };

    const safetyTimer = window.setTimeout(() => {
      triggerComplete();
    }, 7500);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const beginHexDissolve = () => {
      if (cancelled || completed) return;
      window.clearTimeout(safetyTimer);
      setIsDissolving(true);
      finishTimer = window.setTimeout(triggerComplete, 420);
    };

    const scheduleWordmarkReveal = () => {
      if (cancelled || wordmarkTimer !== null) return;
      wordmarkTimer = window.setTimeout(() => {
        if (!cancelled) {
          setWordmarkVisible(true);
        }
      }, 1450);
    };

    const startAnimation = async () => {
      try {
        const [lottieModule, jsonModule] = await Promise.all([
          import('lottie-web'),
          import('../assets/logo_nave_orbita_v5.json'),
        ]);

        if (cancelled || !containerRef.current) return;

        const candidate = (lottieModule.default ?? lottieModule) as LottiePlayer & {
          default?: LottiePlayer;
        };
        const lottie: LottiePlayer | undefined =
          typeof candidate.loadAnimation === 'function' ? candidate : candidate.default;

        if (!lottie || typeof lottie.loadAnimation !== 'function') {
          throw new Error('Lottie player unavailable');
        }

        const rawData = jsonModule.default ?? jsonModule;
        const animationData = JSON.parse(JSON.stringify(rawData)) as Record<string, unknown>;

        containerRef.current.innerHTML = '';
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
            setWordmarkVisible(true);
            finishTimer = window.setTimeout(triggerComplete, 1000);
          };

          if (anim.isLoaded && anim.totalFrames > 0) {
            handleReducedLoaded();
          } else {
            anim.addEventListener('DOMLoaded', handleReducedLoaded);
          }
        } else {
          if (anim.isLoaded && anim.totalFrames > 0) {
            scheduleWordmarkReveal();
          } else {
            anim.addEventListener('DOMLoaded', scheduleWordmarkReveal);
          }
          anim.addEventListener('complete', () => {
            if (cancelled) return;
            holdLastFrame();
            setWordmarkVisible(true);
            holdTimer = window.setTimeout(beginHexDissolve, 1000);
          });
        }
      } catch {
        triggerComplete();
      }
    };

    void startAnimation();

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      if (wordmarkTimer !== null) {
        window.clearTimeout(wordmarkTimer);
      }
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
      }
      if (finishTimer !== null) {
        window.clearTimeout(finishTimer);
      }
      anim?.destroy();
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      className={`startup-splash-screen${isDissolving ? ' is-dissolving' : ''}`}
      role="status"
      aria-label="Cargando aplicación TraumaTeam"
    >
      <svg
        className="startup-splash-hex-svg"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {tiles.map((tile) => (
          <polygon
            key={tile.key}
            points={tile.points}
            className="startup-splash-hex-poly"
            style={{ '--hex-delay': `${Math.round(tile.d * 460)}ms` } as CSSProperties}
          />
        ))}
      </svg>
      <div className="startup-splash-solid-bg" aria-hidden="true" />

      <div
        className={`startup-splash-lockup${wordmarkVisible ? ' is-wordmark-visible' : ''}`}
      >
        <div ref={containerRef} className="startup-splash-lottie-stage" />

        <svg
          className="startup-splash-wordmark"
          viewBox="0 0 342.6 27.64"
          aria-label="TraumaTeam"
        >
          {/* Trauma (#313643) */}
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 0 } as CSSProperties}
            fill="#313643"
            d="M0,0h26.45v4.06h-10.71v23.58h-4.86V4.06H0V0Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 1 } as CSSProperties}
            fill="#313643"
            d="M31.52,15.12q0-2.7,1.92-4.61t4.61-1.92h16.19v3.5h-14.24q-1.41,0-2.42,1-1,.99-1,2.42v12.13h-5.06V15.12Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 2 } as CSSProperties}
            fill="#313643"
            d="M84.67,21.72q-.02,2.69-1.8,4.32t-4.78,1.6h-15.12q-2.95,0-4.77-1.55-1.81-1.56-1.81-4.1v-.27q0-2.54,1.81-4.1,1.82-1.57,4.77-1.57h13.16q1.96,0,3.48.75v-1.53q0-1.19-1-2.15-1.05-1.03-2.48-1.03h-17.58v-3.5h19.54q2.67,0,4.62,1.88,1.96,1.85,1.96,4.41V21.72ZM76.13,24.36q3.48,0,3.48-2.66,0-1.29-1.35-1.93-.88-.41-2.13-.41h-11.21q-1.27,0-2.13.41-1.34.64-1.34,1.95v.27q0,1.31,1.34,1.96.88.41,2.13.41H76.13Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 3 } as CSSProperties}
            fill="#313643"
            d="M112.4,8.59h5.04v12.52q0,2.7-1.91,4.61t-4.61,1.92h-15.24q-2.69,0-4.61-1.92-1.91-1.91-1.91-4.61v-12.52h5.06v12.13q0,1.43.99,2.42,1.02,1.02,2.43,1.02h11.32q1.43,0,2.43-1.02,1.01-.99,1.01-2.42V8.59Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 4 } as CSSProperties}
            fill="#313643"
            d="M158.81,8.59q2.71,0,4.65,1.92t1.93,4.67v12.46h-5.06v-12.07q0-1.45-1.01-2.46-1.02-1.04-2.46-1.04h-6.9q-1.44,0-2.46,1.02-1.02,1.03-1.02,2.46v12.09h-5.05v-12.07q0-1.45-1.02-2.48-1.01-1.02-2.46-1.02h-5.65q-1.95,0-3.34,1.39-1.38,1.38-1.38,3.36v10.82h-5.06v-11.6h.02q.14-3.13,2.4-5.28,2.29-2.17,5.41-2.17h8.58q3.04,0,5.02,2.35,1.99-2.35,5.03-2.35H158.81Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 5 } as CSSProperties}
            fill="#313643"
            d="M198.16,21.72q-.01,2.69-1.79,4.32t-4.79,1.6h-15.12q-2.94,0-4.76-1.55-1.82-1.56-1.82-4.1v-.27q0-2.54,1.82-4.1,1.82-1.57,4.76-1.57h13.17q1.95,0,3.48.75v-1.53q0-1.19-1-2.15-1.06-1.03-2.48-1.03h-17.58v-3.5h19.53q2.68,0,4.63,1.88,1.95,1.85,1.95,4.41V21.72ZM189.63,24.36q3.47,0,3.48-2.66,0-1.29-1.35-1.93-.88-.41-2.13-.41h-11.21q-1.27,0-2.13.41-1.35.64-1.35,1.95v.27q0,1.31,1.35,1.96.88.41,2.13.41H189.63Z"
          />
          {/* Team (#616470) */}
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 6 } as CSSProperties}
            fill="#616470"
            d="M202.66,0h26.44v3.09h-11.68v24.55h-3.1V3.09h-11.66V0Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 7 } as CSSProperties}
            fill="#616470"
            d="M254.61,8.59q3.24,0,5.55,2.31t2.3,5.53v2.57h-25.19v2.05q0,1.45,1.03,2.47,1.02,1.03,2.46,1.03h21.68v3.09h-21.68q-2.73,0-4.67-1.94-1.91-1.91-1.91-4.65v-5.87q0-2.72,1.91-4.65,1.94-1.94,4.67-1.94H254.61ZM259.32,15.9q-.2-1.78-1.55-2.99-1.34-1.21-3.16-1.21h-13.85q-1.44,0-2.46,1.01-1.03,1.02-1.03,2.47v.72H259.32Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 8 } as CSSProperties}
            fill="#616470"
            d="M295.23,21.72q-.01,2.69-1.79,4.32t-4.79,1.6h-15.11q-2.95,0-4.77-1.55-1.82-1.56-1.82-4.1v-.27q0-2.54,1.82-4.1,1.82-1.57,4.77-1.57h15.11q1.95,0,3.48.75v-1.92q0-1.19-1-2.15-1.05-1.03-2.48-1.03h-19.53v-3.11h19.53q2.68,0,4.63,1.88,1.95,1.85,1.95,4.41V21.72ZM288.65,24.55q3.48,0,3.48-2.85,0-1.48-1.35-2.13-.88-.41-2.13-.41h-15.11q-1.27,0-2.13.41-1.35.64-1.35,2.15v.27q0,1.51,1.35,2.15.88.41,2.13.41H288.65Z"
          />
          <path
            className="startup-wordmark-letter"
            style={{ '--letter-idx': 9 } as CSSProperties}
            fill="#616470"
            d="M336.02,8.59q2.71,0,4.64,1.92t1.94,4.67v12.46h-3.11v-12.46q0-1.45-1.01-2.47-1.02-1.03-2.46-1.03h-9.83q-1.44,0-2.46,1.02-1.01,1.03-1.02,2.46v12.48h-3.1v-12.46q0-1.45-1.02-2.48-1.01-1.02-2.46-1.02h-8.57q-1.95,0-3.34,1.39-1.39,1.38-1.39,3.36v11.21h-3.1v-11.6h.02q.13-3.13,2.4-5.28,2.28-2.17,5.41-2.17h8.57q3.05,0,5.02,2.35,1.99-2.35,5.04-2.35H336.02Z"
          />
        </svg>
      </div>
    </div>
  );
}
