import { useEffect, useMemo, useRef } from 'react';

interface HexagonalVaultBackgroundProps {
  themeMode: 'light' | 'dark';
}

interface HexVertex {
  x: number;
  y: number;
  edgeIds: number[];
}

interface HexEdge {
  v0: number;
  v1: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mx: number;
  my: number;
  glow: number;
  target: number;
  shimmerPhase: number;
}

interface HexCell {
  cx: number;
  cy: number;
  edgeIds: number[];
  vertexIds: number[];
}

interface HexLattice {
  vertices: HexVertex[];
  edges: HexEdge[];
  cells: HexCell[];
}

interface TrailSegment {
  edgeId: number;
  fromVertex: number;
}

interface EdgeWalker {
  fromVertex: number;
  toVertex: number;
  edgeId: number;
  progress: number;
  speed: number;
  trail: TrailSegment[];
}

interface HexPulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  strength: number;
}

const HEX_RADIUS = 82;
const TRAIL_LENGTH = 3;
const BASE_WALKER_COUNT = 5;
const SEED_VALUE = 2;

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createGrainDataUrl(seed: number): string {
  if (typeof document === 'undefined') return '';
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(size, size);
  const data = img.data;
  const rng = createSeededRng(seed + 17);

  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(128 + (rng() - 0.5) * 44);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function buildHexLattice(width: number, height: number, radius: number): HexLattice {
  const vertices: HexVertex[] = [];
  const edges: HexEdge[] = [];
  const cells: HexCell[] = [];
  const vertexMap = new Map<string, number>();
  const edgeMap = new Map<string, number>();
  const rng = createSeededRng(SEED_VALUE);

  const dx = 1.5 * radius;
  const dy = Math.sqrt(3) * radius;
  const cols = Math.ceil(width / dx) + 3;
  const rows = Math.ceil(height / dy) + 3;

  const getVertexId = (x: number, y: number): number => {
    const key = `${Math.round(x * 2)},${Math.round(y * 2)}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;
    const id = vertices.length;
    vertices.push({ x, y, edgeIds: [] });
    vertexMap.set(key, id);
    return id;
  };

  const getEdgeId = (v0: number, v1: number): number => {
    const a = Math.min(v0, v1);
    const b = Math.max(v0, v1);
    const key = `${a}-${b}`;
    const existing = edgeMap.get(key);
    if (existing !== undefined) return existing;

    const p0 = vertices[a];
    const p1 = vertices[b];
    const id = edges.length;
    edges.push({
      v0: a,
      v1: b,
      x0: p0.x,
      y0: p0.y,
      x1: p1.x,
      y1: p1.y,
      mx: (p0.x + p1.x) * 0.5,
      my: (p0.y + p1.y) * 0.5,
      glow: 0,
      target: 0,
      shimmerPhase: rng() * Math.PI * 2,
    });
    edgeMap.set(key, id);
    vertices[a].edgeIds.push(id);
    vertices[b].edgeIds.push(id);
    return id;
  };

  for (let c = -1; c <= cols; c++) {
    const cx = c * dx;
    const yOffset = Math.abs(c) % 2 === 1 ? dy * 0.5 : 0;
    for (let r = -1; r <= rows; r++) {
      const cy = r * dy + yOffset;
      const cellVertexIds: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        cellVertexIds.push(
          getVertexId(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
        );
      }

      const cellEdgeIds: number[] = [];
      for (let i = 0; i < 6; i++) {
        cellEdgeIds.push(getEdgeId(cellVertexIds[i], cellVertexIds[(i + 1) % 6]));
      }

      cells.push({ cx, cy, edgeIds: cellEdgeIds, vertexIds: cellVertexIds });
    }
  }

  return { vertices, edges, cells };
}

function getOtherVertex(edge: HexEdge, vertexId: number): number {
  return edge.v0 === vertexId ? edge.v1 : edge.v0;
}

function createWalkers(lattice: HexLattice, width: number, height: number, rng: () => number): EdgeWalker[] {
  const interiorVertices: number[] = [];
  for (let i = 0; i < lattice.vertices.length; i++) {
    const v = lattice.vertices[i];
    if (v.x > width * 0.08 && v.x < width * 0.92 && v.y > height * 0.08 && v.y < height * 0.92 && v.edgeIds.length >= 2) {
      interiorVertices.push(i);
    }
  }

  const pool = interiorVertices.length > 0 ? interiorVertices : lattice.vertices.map((_, idx) => idx);
  if (pool.length === 0) return [];

  const walkers: EdgeWalker[] = [];
  const count = Math.min(BASE_WALKER_COUNT, pool.length);

  for (let i = 0; i < count; i++) {
    const startIdx = pool[Math.floor(((i + 0.35 + rng() * 0.45) / count) * (pool.length - 1))];
    const startVertex = lattice.vertices[startIdx];
    if (!startVertex || startVertex.edgeIds.length === 0) continue;

    const edgeId = startVertex.edgeIds[Math.floor(rng() * startVertex.edgeIds.length)];
    const edge = lattice.edges[edgeId];
    const toVertex = getOtherVertex(edge, startIdx);
    const trail: TrailSegment[] = [];

    const prevEdgeId = startVertex.edgeIds.find((id) => id !== edgeId);
    if (prevEdgeId !== undefined) {
      trail.push({
        edgeId: prevEdgeId,
        fromVertex: getOtherVertex(lattice.edges[prevEdgeId], startIdx),
      });
    }

    walkers.push({
      fromVertex: startIdx,
      toVertex,
      edgeId,
      progress: rng(),
      speed: 0.72 + rng() * 0.48,
      trail,
    });
  }

  return walkers;
}

function advanceWalker(walker: EdgeWalker, lattice: HexLattice, width: number, height: number, rng: () => number): void {
  const currentVertex = lattice.vertices[walker.toVertex];
  if (!currentVertex || currentVertex.edgeIds.length === 0) return;

  walker.trail.unshift({ edgeId: walker.edgeId, fromVertex: walker.fromVertex });
  if (walker.trail.length > TRAIL_LENGTH) {
    walker.trail.pop();
  }

  const forwardEdges = currentVertex.edgeIds.filter((id) => id !== walker.edgeId);
  const candidates = forwardEdges.length > 0 ? forwardEdges : currentVertex.edgeIds;

  // Prefer edges whose next vertex remains near the visible viewport
  const inBounds = candidates.filter((id) => {
    const nextV = lattice.vertices[getOtherVertex(lattice.edges[id], walker.toVertex)];
    return nextV.x >= -HEX_RADIUS * 0.4 && nextV.x <= width + HEX_RADIUS * 0.4 && nextV.y >= -HEX_RADIUS * 0.4 && nextV.y <= height + HEX_RADIUS * 0.4;
  });

  const choicePool = inBounds.length > 0 ? inBounds : candidates;
  const nextEdgeId = choicePool[Math.floor(rng() * choicePool.length)];
  const nextEdge = lattice.edges[nextEdgeId];

  walker.fromVertex = walker.toVertex;
  walker.toVertex = getOtherVertex(nextEdge, walker.toVertex);
  walker.edgeId = nextEdgeId;
  walker.progress = 0;
}

function seedReducedMotionGlow(lattice: HexLattice, width: number, height: number): void {
  const anchors = [
    { x: width * 0.36, y: height * 0.42, r: HEX_RADIUS * 2.5 },
    { x: width * 0.72, y: height * 0.62, r: HEX_RADIUS * 2.0 },
  ];

  for (let i = 0; i < lattice.edges.length; i++) {
    const edge = lattice.edges[i];
    let best = 0;
    for (let a = 0; a < anchors.length; a++) {
      const anchor = anchors[a];
      const dist = Math.hypot(edge.mx - anchor.x, edge.my - anchor.y);
      if (dist < anchor.r) {
        const falloff = 1 - dist / anchor.r;
        best = Math.max(best, falloff * falloff);
      }
    }
    edge.glow = best;
    edge.target = best;
  }
}

function drawEdgeSegment(
  ctx: CanvasRenderingContext2D,
  edge: HexEdge,
  fromVertex: number,
  fraction: number,
  glowAlpha: number,
  isDark: boolean
): void {
  const fromStart = edge.v0 === fromVertex;
  const sx = fromStart ? edge.x0 : edge.x1;
  const sy = fromStart ? edge.y0 : edge.y1;
  const tx = fromStart ? edge.x1 : edge.x0;
  const ty = fromStart ? edge.y1 : edge.y0;
  const ex = sx + (tx - sx) * fraction;
  const ey = sy + (ty - sy) * fraction;

  ctx.lineCap = 'round';

  // Soft outer cyan halo
  ctx.strokeStyle = isDark
    ? `rgba(147, 222, 255, ${(glowAlpha * 0.34).toFixed(3)})`
    : `rgba(147, 222, 255, ${(glowAlpha * 0.52).toFixed(3)})`;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Mid glowing border
  ctx.strokeStyle = isDark
    ? `rgba(147, 222, 255, ${(glowAlpha * 0.68).toFixed(3)})`
    : `rgba(92, 202, 255, ${(glowAlpha * 0.76).toFixed(3)})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Crisp luminous core
  ctx.strokeStyle = isDark
    ? `rgba(218, 245, 255, ${(glowAlpha * 0.94).toFixed(3)})`
    : `rgba(56, 189, 248, ${(glowAlpha * 0.92).toFixed(3)})`;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

function drawHexLatticeFrame(
  ctx: CanvasRenderingContext2D,
  lattice: HexLattice,
  walkers: EdgeWalker[],
  width: number,
  height: number,
  timeSec: number,
  isDark: boolean
): void {
  ctx.clearRect(0, 0, width, height);

  // 1. Subtle interior tint on cells with active edge energy
  for (let i = 0; i < lattice.cells.length; i++) {
    const cell = lattice.cells[i];
    let sumGlow = 0;
    for (let e = 0; e < cell.edgeIds.length; e++) {
      sumGlow += lattice.edges[cell.edgeIds[e]].glow;
    }
    const avgGlow = sumGlow / 6;
    if (avgGlow < 0.04) continue;

    ctx.fillStyle = isDark
      ? `rgba(147, 222, 255, ${(avgGlow * 0.08).toFixed(3)})`
      : `rgba(147, 222, 255, ${(avgGlow * 0.16).toFixed(3)})`;
    ctx.beginPath();
    for (let v = 0; v < cell.vertexIds.length; v++) {
      const pt = lattice.vertices[cell.vertexIds[v]];
      if (v === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 2. Base static architectural hex lattice
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = isDark ? 'rgba(115, 203, 244, 0.13)' : 'rgba(130, 158, 188, 0.25)';
  ctx.beginPath();
  for (let i = 0; i < lattice.edges.length; i++) {
    const edge = lattice.edges[i];
    ctx.moveTo(edge.x0, edge.y0);
    ctx.lineTo(edge.x1, edge.y1);
  }
  ctx.stroke();

  // 3. Illuminated lattice edges with subtle slow shimmer
  for (let i = 0; i < lattice.edges.length; i++) {
    const edge = lattice.edges[i];
    if (edge.glow < 0.015) continue;

    const shimmer = 0.84 + 0.16 * Math.sin(timeSec * 1.45 + edge.shimmerPhase);
    const alpha = Math.min(1, edge.glow * shimmer);
    drawEdgeSegment(ctx, edge, edge.v0, 1, alpha, isDark);
  }

  // 4. Tracing head edges & soft focal spark for active energy streams
  for (let i = 0; i < walkers.length; i++) {
    const walker = walkers[i];
    const headEdge = lattice.edges[walker.edgeId];
    if (!headEdge) continue;

    drawEdgeSegment(ctx, headEdge, walker.fromVertex, Math.max(0.08, walker.progress), 0.96, isDark);

    const startPt = lattice.vertices[walker.fromVertex];
    const endPt = lattice.vertices[walker.toVertex];
    if (!startPt || !endPt) continue;

    const hx = startPt.x + (endPt.x - startPt.x) * walker.progress;
    const hy = startPt.y + (endPt.y - startPt.y) * walker.progress;
    const spark = ctx.createRadialGradient(hx, hy, 0, hx, hy, 11);
    spark.addColorStop(0, isDark ? 'rgba(224, 247, 255, 0.85)' : 'rgba(147, 222, 255, 0.85)');
    spark.addColorStop(1, 'rgba(147, 222, 255, 0)');
    ctx.fillStyle = spark;
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Fondo hexagonal animado con Tailwind CSS exclusivo para la interfaz web.
 * Traza una red de hexágonos que se ilumina progresivamente mediante flujos de energía y pulsos suaves.
 */
export function HexagonalVaultBackground({ themeMode }: HexagonalVaultBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<'light' | 'dark'>(themeMode);

  const grainDataUrl = useMemo(() => createGrainDataUrl(SEED_VALUE), []);

  useEffect(() => {
    themeRef.current = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    const rng = createSeededRng(SEED_VALUE + 9);

    let width = Math.max(1, container.clientWidth || window.innerWidth);
    let height = Math.max(1, container.clientHeight || window.innerHeight);
    let lattice = buildHexLattice(width, height, HEX_RADIUS);
    let walkers = createWalkers(lattice, width, height, rng);
    const pulses: HexPulse[] = [];

    let rafId = 0;
    let lastTime = performance.now();
    let ambientPulseTimer = 1.6;

    const resizeCanvas = () => {
      const nextWidth = Math.max(1, container.clientWidth || window.innerWidth);
      const nextHeight = Math.max(1, container.clientHeight || window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      lattice = buildHexLattice(width, height, HEX_RADIUS);
      walkers = createWalkers(lattice, width, height, rng);
      if (prefersReducedMotion) {
        seedReducedMotionGlow(lattice, width, height);
        drawHexLatticeFrame(ctx, lattice, [], width, height, 0, themeRef.current === 'dark');
      }
    };

    const spawnPulse = (x: number, y: number, strength = 0.85) => {
      if (pulses.length >= 6) pulses.shift();
      pulses.push({
        x,
        y,
        radius: 0,
        maxRadius: HEX_RADIUS * 3.1,
        speed: 145,
        strength,
      });
    };

    const stepSimulation = (dt: number) => {
      for (let i = 0; i < lattice.edges.length; i++) {
        lattice.edges[i].target = 0;
      }

      // Advance traveling walkers and illuminate nearby connected edges
      for (let i = 0; i < walkers.length; i++) {
        const walker = walkers[i];
        walker.progress += walker.speed * dt;
        if (walker.progress >= 1) {
          advanceWalker(walker, lattice, width, height, rng);
        }

        const headEdge = lattice.edges[walker.edgeId];
        if (headEdge) {
          headEdge.target = Math.max(headEdge.target, 0.88);
        }

        for (let t = 0; t < walker.trail.length; t++) {
          const seg = walker.trail[t];
          const trailEdge = lattice.edges[seg.edgeId];
          if (!trailEdge) continue;
          const intensity = Math.max(0.18, 0.76 * Math.pow(0.58, t));
          trailEdge.target = Math.max(trailEdge.target, intensity);
        }

        const pivotVertex = lattice.vertices[walker.toVertex];
        if (pivotVertex) {
          const proximity = 0.25 + 0.35 * walker.progress;
          for (let e = 0; e < pivotVertex.edgeIds.length; e++) {
            const adjEdge = lattice.edges[pivotVertex.edgeIds[e]];
            if (adjEdge) {
              adjEdge.target = Math.max(adjEdge.target, proximity * 0.55);
            }
          }
        }
      }

      // Periodic calm ambient ripple across the vault
      ambientPulseTimer -= dt;
      if (ambientPulseTimer <= 0) {
        ambientPulseTimer = 2.6 + rng() * 1.8;
        const focusWalker = walkers[Math.floor(rng() * walkers.length)];
        const focusVertex = focusWalker ? lattice.vertices[focusWalker.toVertex] : undefined;
        if (focusVertex) {
          spawnPulse(focusVertex.x, focusVertex.y, 0.62);
        } else {
          spawnPulse(width * (0.25 + rng() * 0.5), height * (0.25 + rng() * 0.5), 0.62);
        }
      }

      // Update expanding hex pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.radius += pulse.speed * dt;
        if (pulse.radius >= pulse.maxRadius) {
          pulses.splice(i, 1);
          continue;
        }

        const bandWidth = HEX_RADIUS * 1.15;
        const fadeOut = 1 - pulse.radius / pulse.maxRadius;
        for (let e = 0; e < lattice.edges.length; e++) {
          const edge = lattice.edges[e];
          const dist = Math.hypot(edge.mx - pulse.x, edge.my - pulse.y);
          const delta = Math.abs(dist - pulse.radius);
          if (delta < bandWidth) {
            const ringEnergy = (1 - delta / bandWidth) * fadeOut * pulse.strength;
            edge.target = Math.max(edge.target, ringEnergy);
          }
        }
      }

      // Smooth exponential illumination and decay per edge
      const smoothRate = Math.min(1, dt * 6.5);
      for (let i = 0; i < lattice.edges.length; i++) {
        const edge = lattice.edges[i];
        edge.glow += (edge.target - edge.glow) * smoothRate;
      }
    };

    const renderFrame = (now: number) => {
      if (prefersReducedMotion || document.visibilityState === 'hidden') {
        rafId = 0;
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      stepSimulation(dt);
      drawHexLatticeFrame(ctx, lattice, walkers, width, height, now / 1000, themeRef.current === 'dark');
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const startLoop = () => {
      if (prefersReducedMotion) {
        seedReducedMotionGlow(lattice, width, height);
        drawHexLatticeFrame(ctx, lattice, [], width, height, 0, themeRef.current === 'dark');
        return;
      }
      if (rafId !== 0 || document.visibilityState === 'hidden') return;
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const stopLoop = () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopLoop();
      } else {
        startLoop();
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      stopLoop();
      startLoop();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (prefersReducedMotion) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [role="button"], .viewer3d-canvas-stage')) {
        return;
      }
      spawnPulse(event.clientX, event.clientY, 0.9);
    };

    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(container);
    resizeCanvas();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    motionQuery.addEventListener('change', handleMotionChange);
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    startLoop();

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  // Re-paint immediately when reduced motion is enabled and theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.width / dpr));
    const height = Math.max(1, Math.round(canvas.height / dpr));
    const lattice = buildHexLattice(width, height, HEX_RADIUS);
    seedReducedMotionGlow(lattice, width, height);
    drawHexLatticeFrame(ctx, lattice, [], width, height, 0, themeMode === 'dark');
  }, [themeMode]);

  const isDarkTheme = themeMode === 'dark';

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed inset-0 z-0 h-full w-full overflow-hidden pointer-events-none select-none transition-colors duration-300 ${
        isDarkTheme ? 'bg-[#060d1f]' : 'bg-[#d9e3ef]'
      }`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {/* Profundidad radial suave y viñeta sutil en los bordes */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDarkTheme
            ? 'bg-[radial-gradient(circle_at_36%_42%,rgba(147,222,255,0.08)_0%,transparent_52%),radial-gradient(ellipse_at_center,transparent_45%,rgba(2,6,23,0.62)_100%)]'
            : 'bg-[radial-gradient(circle_at_36%_42%,rgba(147,222,255,0.16)_0%,transparent_52%),radial-gradient(ellipse_at_center,transparent_48%,rgba(145,168,194,0.24)_100%)]'
        }`}
      />

      {/* Textura de grano fino tipo bóveda mate */}
      {grainDataUrl && (
        <div
          className={`pointer-events-none absolute inset-0 bg-repeat mix-blend-soft-light ${
            isDarkTheme ? 'opacity-[0.22]' : 'opacity-[0.42]'
          }`}
          style={{ backgroundImage: `url(${grainDataUrl})`, backgroundSize: '128px 128px' }}
        />
      )}
    </div>
  );
}
