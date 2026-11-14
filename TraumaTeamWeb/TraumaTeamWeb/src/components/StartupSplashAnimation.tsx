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
    let holdTimer: number | null = null;
    let finishTimer: number | null = null;

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

    const beginHexDissolve = () => {
      if (cancelled || completed) return;
      window.clearTimeout(safetyTimer);
      setIsDissolving(true);
      finishTimer = window.setTimeout(triggerComplete, 960);
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
            holdTimer = window.setTimeout(beginHexDissolve, 150);
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
      <div ref={containerRef} className="startup-splash-lottie-stage" />
    </div>
  );
}
