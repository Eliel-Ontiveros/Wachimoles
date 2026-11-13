import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { MUSCLE_MODEL_BASE64 } from '@/assets/images/muscle-model-base64';

export type MuscleStatus = 'normal' | 'warning' | 'critical';

export type BodyRegionCategory =
  | 'Cabeza y cuello'
  | 'Tronco anterior'
  | 'Tronco posterior'
  | 'Extremidad superior'
  | 'Cadera y pelvis'
  | 'Extremidad inferior';

export interface MuscleObservation {
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  notes: string;
  updatedAt: string;
}

// Zona anatómica definida por elipsoide 3D (centro, radios, normal y cámara)
export interface MuscleData {
  id: string;
  name: string;
  category: BodyRegionCategory;
  status: MuscleStatus;
  observation?: MuscleObservation;
  center: [number, number, number];
  radii: [number, number, number];
  normal: [number, number, number];
  cameraAngles: [number, number, number];
}

export interface BodyModelViewerProps {
  muscles: MuscleData[];
  selectedMuscle: string;
  onSelectMuscle: (muscleName: string) => void;
  isLocked?: boolean;
  onTouchStateChange?: (touching: boolean) => void;
  onZoneSnapshot?: (zoneId: string, dataUrl: string) => void;
}

// Color HEX según intensidad de dolor (1 amarillo -> 5 naranja -> 10 rojo)
export function getPainColorHex(intensity?: number): string {
  if (!intensity || intensity <= 0) return '#94a3b8';
  const clamped = Math.max(1, Math.min(10, intensity));

  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  const toHex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');

  if (clamped <= 5) {
    const t = (clamped - 1) / 4;
    return toHex(lerp(253, 249, t), lerp(224, 115, t), lerp(71, 22, t));
  }
  if (clamped <= 8) {
    const t = (clamped - 5) / 3;
    return toHex(lerp(249, 239, t), lerp(115, 68, t), lerp(22, 68, t));
  }
  const t = (clamped - 8) / 2;
  return toHex(lerp(239, 153, t), lerp(68, 27, t), lerp(68, 27, t));
}

// Catálogo de zonas anatómicas (31 zonas)
export const INITIAL_MUSCLES: MuscleData[] = [
  // ==================== CABEZA Y CUELLO ====================
  {
    id: 'cara',
    name: 'Cara / Región facial',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.785, 0.08],
    radii: [0.09, 0.09, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [0, 78, 1.45],
  },
  {
    id: 'cabeza',
    name: 'Cabeza / Cráneo',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.83, -0.045],
    radii: [0.095, 0.105, 0.09],
    normal: [0, 0.35, -1],
    cameraAngles: [180, 70, 1.5],
  },
  {
    id: 'cuello',
    name: 'Cuello',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.665, 0.035],
    radii: [0.08, 0.065, 0.065],
    normal: [0, 0, 1],
    cameraAngles: [0, 80, 1.55],
  },
  {
    id: 'trapecio',
    name: 'Trapecio / Nuca',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.59, -0.07],
    radii: [0.145, 0.075, 0.08],
    normal: [0, 0.25, -1],
    cameraAngles: [180, 72, 1.75],
  },

  // ==================== TRONCO ANTERIOR ====================
  {
    id: 'pectoral_der',
    name: 'Pectoral derecho',
    category: 'Tronco anterior',
    status: 'normal',
    center: [-0.085, 0.40, 0.085],
    radii: [0.09, 0.095, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [-12, 78, 1.85],
  },
  {
    id: 'pectoral_izq',
    name: 'Pectoral izquierdo',
    category: 'Tronco anterior',
    status: 'normal',
    center: [0.085, 0.40, 0.085],
    radii: [0.09, 0.095, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [12, 78, 1.85],
  },
  {
    id: 'abdomen',
    name: 'Abdomen',
    category: 'Tronco anterior',
    status: 'normal',
    center: [0.0, 0.14, 0.07],
    radii: [0.10, 0.135, 0.07],
    normal: [0, 0, 1],
    cameraAngles: [0, 82, 1.9],
  },
  {
    id: 'oblicuo_der',
    name: 'Oblicuo derecho',
    category: 'Tronco anterior',
    status: 'normal',
    center: [-0.125, 0.14, 0.015],
    radii: [0.065, 0.115, 0.08],
    normal: [-0.85, 0, 0.5],
    cameraAngles: [-55, 82, 1.9],
  },
  {
    id: 'oblicuo_izq',
    name: 'Oblicuo izquierdo',
    category: 'Tronco anterior',
    status: 'normal',
    center: [0.125, 0.14, 0.015],
    radii: [0.065, 0.115, 0.08],
    normal: [0.85, 0, 0.5],
    cameraAngles: [55, 82, 1.9],
  },

  // ==================== TRONCO POSTERIOR ====================
  {
    id: 'dorsal_der',
    name: 'Dorsal derecho',
    category: 'Tronco posterior',
    status: 'normal',
    center: [-0.095, 0.36, -0.115],
    radii: [0.095, 0.125, 0.08],
    normal: [0, 0, -1],
    cameraAngles: [195, 78, 1.9],
  },
  {
    id: 'dorsal_izq',
    name: 'Dorsal izquierdo',
    category: 'Tronco posterior',
    status: 'normal',
    center: [0.095, 0.36, -0.115],
    radii: [0.095, 0.125, 0.08],
    normal: [0, 0, -1],
    cameraAngles: [165, 78, 1.9],
  },
  {
    id: 'lumbar',
    name: 'Zona lumbar',
    category: 'Tronco posterior',
    status: 'normal',
    center: [0.0, 0.13, -0.105],
    radii: [0.115, 0.10, 0.08],
    normal: [0, 0, -1],
    cameraAngles: [180, 82, 1.9],
  },

  // ==================== EXTREMIDAD SUPERIOR ====================
  {
    id: 'deltoides_der',
    name: 'Deltoides derecho',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.225, 0.46, -0.03],
    radii: [0.08, 0.085, 0.085],
    normal: [-1, 0.2, 0],
    cameraAngles: [-75, 76, 1.85],
  },
  {
    id: 'deltoides_izq',
    name: 'Deltoides izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.225, 0.46, -0.03],
    radii: [0.08, 0.085, 0.085],
    normal: [1, 0.2, 0],
    cameraAngles: [75, 76, 1.85],
  },
  {
    id: 'biceps_der',
    name: 'Bíceps derecho',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.30, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, 0.8],
    cameraAngles: [-35, 80, 1.85],
  },
  {
    id: 'biceps_izq',
    name: 'Bíceps izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.30, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [0.6, 0, 0.8],
    cameraAngles: [35, 80, 1.85],
  },
  {
    id: 'triceps_der',
    name: 'Tríceps derecho',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.29, 0.30, -0.06],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, -0.8],
    cameraAngles: [-145, 80, 1.85],
  },
  {
    id: 'triceps_izq',
    name: 'Tríceps izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.29, 0.30, -0.06],
    radii: [0.075, 0.09, 0.055],
    normal: [0.6, 0, -0.8],
    cameraAngles: [145, 80, 1.85],
  },
  {
    id: 'antebrazo_der',
    name: 'Antebrazo derecho',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.365, 0.155, -0.005],
    radii: [0.08, 0.095, 0.08],
    normal: [-0.8, 0, 0.6],
    cameraAngles: [-50, 82, 1.85],
  },
  {
    id: 'antebrazo_izq',
    name: 'Antebrazo izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.365, 0.155, -0.005],
    radii: [0.08, 0.095, 0.08],
    normal: [0.8, 0, 0.6],
    cameraAngles: [50, 82, 1.85],
  },
  {
    id: 'mano_der',
    name: 'Mano derecha',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.44, 0.015, 0.065],
    radii: [0.075, 0.085, 0.085],
    normal: [-0.7, 0, 0.7],
    cameraAngles: [-45, 84, 1.75],
  },
  {
    id: 'mano_izq',
    name: 'Mano izquierda',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.44, 0.015, 0.065],
    radii: [0.075, 0.085, 0.085],
    normal: [0.7, 0, 0.7],
    cameraAngles: [45, 84, 1.75],
  },

  // ==================== CADERA Y PELVIS ====================
  {
    id: 'gluteo_der',
    name: 'Glúteo derecho',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [-0.09, -0.04, -0.105],
    radii: [0.09, 0.095, 0.085],
    normal: [0, 0, -1],
    cameraAngles: [195, 85, 1.9],
  },
  {
    id: 'gluteo_izq',
    name: 'Glúteo izquierdo',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [0.09, -0.04, -0.105],
    radii: [0.09, 0.095, 0.085],
    normal: [0, 0, -1],
    cameraAngles: [165, 85, 1.9],
  },
  {
    id: 'abductor_der',
    name: 'Abductor / Cadera derecha',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [-0.165, -0.08, -0.01],
    radii: [0.06, 0.105, 0.09],
    normal: [-1, 0, 0],
    cameraAngles: [-85, 85, 1.9],
  },
  {
    id: 'abductor_izq',
    name: 'Abductor / Cadera izquierda',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [0.165, -0.08, -0.01],
    radii: [0.06, 0.105, 0.09],
    normal: [1, 0, 0],
    cameraAngles: [85, 85, 1.9],
  },

  // ==================== EXTREMIDAD INFERIOR ====================
  {
    id: 'muslo_der',
    name: 'Muslo derecho (Cuádriceps)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.11, -0.25, 0.045],
    radii: [0.095, 0.17, 0.07],
    normal: [0, 0, 1],
    cameraAngles: [-12, 84, 1.95],
  },
  {
    id: 'muslo_izq',
    name: 'Muslo izquierdo (Cuádriceps)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.11, -0.25, 0.045],
    radii: [0.095, 0.17, 0.07],
    normal: [0, 0, 1],
    cameraAngles: [12, 84, 1.95],
  },
  {
    id: 'isquio_der',
    name: 'Isquiotibiales der. (Pierna trasera)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.115, -0.28, -0.065],
    radii: [0.095, 0.165, 0.07],
    normal: [0, 0, -1],
    cameraAngles: [195, 86, 1.95],
  },
  {
    id: 'isquio_izq',
    name: 'Isquiotibiales izq. (Pierna trasera)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.115, -0.28, -0.065],
    radii: [0.095, 0.165, 0.07],
    normal: [0, 0, -1],
    cameraAngles: [165, 86, 1.95],
  },
  {
    id: 'gemelo_der',
    name: 'Gemelo derecho (Pantorrilla)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.155, -0.63, -0.06],
    radii: [0.075, 0.145, 0.065],
    normal: [0, 0, -1],
    cameraAngles: [195, 88, 1.85],
  },
  {
    id: 'gemelo_izq',
    name: 'Gemelo izquierdo (Pantorrilla)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.155, -0.63, -0.06],
    radii: [0.075, 0.145, 0.065],
    normal: [0, 0, -1],
    cameraAngles: [165, 88, 1.85],
  },
  {
    id: 'espinilla_der',
    name: 'Espinilla / Tibial derecho',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.155, -0.62, 0.01],
    radii: [0.07, 0.14, 0.055],
    normal: [0, 0, 1],
    cameraAngles: [-12, 88, 1.85],
  },
  {
    id: 'espinilla_izq',
    name: 'Espinilla / Tibial izquierdo',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.155, -0.62, 0.01],
    radii: [0.07, 0.14, 0.055],
    normal: [0, 0, 1],
    cameraAngles: [12, 88, 1.85],
  },
  {
    id: 'pie_der',
    name: 'Pie derecho',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.175, -0.90, 0.025],
    radii: [0.08, 0.075, 0.14],
    normal: [0, 0.35, 1],
    cameraAngles: [-15, 82, 1.65],
  },
  {
    id: 'pie_izq',
    name: 'Pie izquierdo',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.175, -0.90, 0.025],
    radii: [0.08, 0.075, 0.14],
    normal: [0, 0.35, 1],
    cameraAngles: [15, 82, 1.65],
  },
];

// Carga segura de react-native-webview para iOS y Android
let NativeWebView: any = null;
if (Platform.OS !== 'web') {
  try {
    NativeWebView = require('react-native-webview').WebView;
  } catch (e) {}
}

export function BodyModelViewer({
  muscles,
  selectedMuscle,
  onSelectMuscle,
  isLocked = false,
  onTouchStateChange,
  onZoneSnapshot,
}: BodyModelViewerProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onZoneSnapshotRef = useRef(onZoneSnapshot);
  onZoneSnapshotRef.current = onZoneSnapshot;

  // Sincroniza cambios de estado (músculo seleccionado, bloqueo de vista, intensidad de dolor) con la escena 3D
  useEffect(() => {
    const payload = JSON.stringify({
      type: 'SYNC_STATE',
      selected: selectedMuscle,
      locked: isLocked,
      muscles: muscles.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        painIntensity: m.observation?.painIntensity ?? 0,
      })),
    });

    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(payload, '*');
    } else {
      webViewRef.current?.injectJavaScript(`
        if (window.onParentMessage) {
          window.onParentMessage(${payload});
        }
        true;
      `);
    }
  }, [selectedMuscle, isLocked, muscles]);

  // Escucha eventos desde el iframe cuando se ejecuta en navegador Web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onWebMsg = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'SELECT_MUSCLE' && data.name) {
          onSelectMuscle(data.name);
        } else if (data?.type === 'ZONE_SNAPSHOT' && data.zoneId && data.dataUrl) {
          onZoneSnapshotRef.current?.(data.zoneId, data.dataUrl);
        } else if (data?.type === 'TOUCH_START') {
          onTouchStateChange?.(true);
        } else if (data?.type === 'TOUCH_END') {
          onTouchStateChange?.(false);
        }
      } catch (e) {}
    };
    window.addEventListener('message', onWebMsg);
    return () => window.removeEventListener('message', onWebMsg);
  }, [onSelectMuscle, onTouchStateChange]);

  const initialZonesJson = useRef(
    JSON.stringify(
      muscles.map((m) => ({
        ...m,
        painIntensity: m.observation?.painIntensity ?? 0,
      }))
    )
  ).current;
  const initialSelected = useRef(selectedMuscle).current;

  const htmlContent = useRef(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      /* Fondo claro anterior: background: #f8fafc; */
      background: radial-gradient(circle at 50% 35%, #0f172a 0%, #060b19 70%, #020617 100%);
      overflow: hidden;
      font-family: monospace;
      touch-action: none;
    }
    #canvas-container {
      width: 100%;
      height: 100%;
      position: relative;
      touch-action: none;
    }
    canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      touch-action: none;
    }

    /* Capa de indicadores (pines circulares discretos con icono SVG, sin texto ni emojis) */
    #pins-layer {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      overflow: hidden;
      transition: opacity 0.25s ease;
    }
    .zone-pin {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.18s ease, background-color 0.2s ease, border-color 0.2s ease;
      background: rgba(255, 255, 255, 0.68);
      border: 1.3px solid rgba(100, 116, 139, 0.4);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
    }
    .zone-pin svg {
      width: 9px;
      height: 9px;
      stroke: #475569;
      stroke-width: 2.3;
      fill: none;
    }
    .zone-pin.has-pain {
      width: 22px;
      height: 22px;
    }
    .zone-pin.has-pain svg {
      width: 11px;
      height: 11px;
      stroke: #ffffff;
    }
    .zone-pin.active {
      width: 23px;
      height: 23px;
      transform: translate(-50%, -50%) scale(1.18);
      background: #38bdf8 !important;
      border-color: #0284c7 !important;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.85) !important;
      z-index: 25;
    }
    .zone-pin.active svg {
      width: 11px;
      height: 11px;
      stroke: #ffffff !important;
    }

    /* Botones flotantes de control rápido de cámara 3D (esquina derecha) */
    #hud-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 40;
    }
    .ctrl-btn {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      /* Estilo claro anterior:
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid #cbd5e1;
      */
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(56, 189, 248, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
      transition: transform 0.12s ease, background-color 0.15s ease;
    }
    .ctrl-btn:active {
      transform: scale(0.92);
      background: rgba(56, 189, 248, 0.25);
      border-color: #38bdf8;
    }
    .ctrl-btn.toggled-off {
      opacity: 0.55;
    }
    .ctrl-btn svg {
      width: 16px;
      height: 16px;
      /* stroke: #1e293b; */
      stroke: #e2e8f0;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Pantalla de carga */
    #loading {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      /* Fondo claro anterior:
      background: #f8fafc;
      color: #0284c7;
      */
      background: #060b19;
      z-index: 100;
      transition: opacity 0.35s ease;
      font-size: 11px;
      color: #38bdf8;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .spinner {
      width: 28px;
      height: 28px;
      /* Spinner claro anterior:
      border: 3px solid #e0f2fe;
      border-top-color: #0284c7;
      */
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 10px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <span>CARGANDO ANATOMÍA 3D...</span>
  </div>

  <div id="canvas-container">
    <div id="pins-layer"></div>

    <!-- Controles rápidos 3D con iconos vectoriales SVG -->
    <div id="hud-controls">
      <!-- Girar Frente / Espalda (180°) -->
      <button id="btn-flip" class="ctrl-btn" title="Girar Frente / Espalda">
        <svg viewBox="0 0 24 24"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h14"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H3"/></svg>
      </button>
      <!-- Acercar Zoom (+) -->
      <button id="btn-zoom-in" class="ctrl-btn" title="Acercar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <!-- Alejar Zoom (-) -->
      <button id="btn-zoom-out" class="ctrl-btn" title="Alejar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <!-- Centrar Cuerpo Completo -->
      <button id="btn-reset" class="ctrl-btn" title="Centrar vista">
        <svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <!-- Mostrar / Ocultar Pines -->
      <button id="btn-toggle-pins" class="ctrl-btn" title="Mostrar/Ocultar indicadores">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

    const container = document.getElementById('canvas-container');
    const pinsLayer = document.getElementById('pins-layer');
    const loadingEl = document.getElementById('loading');

    let zones = ${initialZonesJson};
    let selectedName = ${JSON.stringify(initialSelected)};
    let showPins = true;
    let isFrontView = true;

    function postMsg(data) {
      const msg = JSON.stringify(data);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent) {
        window.parent.postMessage(msg, '*');
      }
    }

    // Color gradual de dolor 1 (amarillo) a 10 (rojo)
    function getGradualPainColor(intensity) {
      const c = Math.max(1, Math.min(10, intensity || 1));
      const lerp = (a, b, t) => a + (b - a) * t;
      let r, g, b;
      if (c <= 5) {
        const t = (c - 1) / 4;
        r = lerp(253, 249, t) / 255;
        g = lerp(224, 115, t) / 255;
        b = lerp(71, 22, t) / 255;
      } else if (c <= 8) {
        const t = (c - 5) / 3;
        r = lerp(249, 239, t) / 255;
        g = lerp(115, 68, t) / 255;
        b = lerp(22, 68, t) / 255;
      } else {
        const t = (c - 8) / 2;
        r = lerp(239, 153, t) / 255;
        g = lerp(68, 27, t) / 255;
        b = lerp(68, 27, t) / 255;
      }
      return new THREE.Color(r, g, b);
    }

    // Bloquea scroll y gestos de retroceso del sistema al tocar el canvas 3D
    window.addEventListener('touchstart', () => postMsg({ type: 'TOUCH_START' }), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', () => postMsg({ type: 'TOUCH_END' }), { passive: true });
    window.addEventListener('touchcancel', () => postMsg({ type: 'TOUCH_END' }), { passive: true });
    window.addEventListener('mousedown', () => postMsg({ type: 'TOUCH_START' }));
    window.addEventListener('mouseup', () => postMsg({ type: 'TOUCH_END' }));

    // Configuración de escena Three.js
    const scene = new THREE.Scene();
    // Fondo claro anterior: scene.background = new THREE.Color(0xf8fafc);
    scene.background = new THREE.Color(0x060b19);

    // Campo estelar espacial de fondo
    const starCount = 320;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 4.2 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.035,
      transparent: true,
      opacity: 0.82,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 20);
    camera.position.set(0, 0.08, 2.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.insertBefore(renderer.domElement, pinsLayer);

    // Controles mejorados: permite rotación 360°, zoom suave y desplazamiento vertical/horizontal con 2 dedos
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.8;
    controls.minDistance = 0.85;
    controls.maxDistance = 3.2;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.target.set(0, 0.0, 0);

    // Iluminación de estudio anatómico sobre fondo espacial
    // Anterior claro: const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.15);
    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x334155, 1.25);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(1.5, 2.5, 2.5);
    scene.add(dirLight1);

    // Anterior claro: const dirLight2 = new THREE.DirectionalLight(0xe2e8f0, 0.85);
    const dirLight2 = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    dirLight2.position.set(-1.5, 1.5, -2.5);
    scene.add(dirLight2);

    // Aro base orbital en el suelo
    const ringGeo = new THREE.RingGeometry(0.32, 0.34, 48);
    ringGeo.rotateX(-Math.PI / 2);
    // Anterior claro: const ringMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const floorRing = new THREE.Mesh(ringGeo, ringMat);
    floorRing.position.y = -0.95;
    scene.add(floorRing);

    // Iconos SVG vectoriales limpios para los indicadores
    function getPinSvg(hasPain, isActive) {
      if (hasPain) {
        return '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
      }
      if (isActive) {
        return '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.5"/></svg>';
    }

    const pinElements = {};
    zones.forEach((z) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-pin';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectZone(z.name, true);
      });
      pinsLayer.appendChild(btn);
      pinElements[z.id] = btn;
    });

    function refreshPinsDOM() {
      zones.forEach((z) => {
        const btn = pinElements[z.id];
        if (!btn) return;
        const isActive = z.name.toLowerCase() === (selectedName || '').toLowerCase();
        const hasPain = z.status !== 'normal' && (z.painIntensity || 0) > 0;
        btn.className = 'zone-pin' + (hasPain ? ' has-pain' : '') + (isActive ? ' active' : '');
        btn.innerHTML = getPinSvg(hasPain, isActive);

        if (hasPain && !isActive) {
          const col = getGradualPainColor(z.painIntensity || 5);
          const hex = '#' + col.getHexString();
          btn.style.backgroundColor = hex;
          btn.style.borderColor = '#ffffff';
          btn.style.boxShadow = '0 0 8px ' + hex;
        } else if (!isActive) {
          btn.style.backgroundColor = '';
          btn.style.borderColor = '';
          btn.style.boxShadow = '';
        }
      });
    }
    refreshPinsDOM();

    let bodyMeshes = [];
    let meshZoneData = [];

    const BASE_COLOR = new THREE.Color(0xe5e9f0);     // Gris-blanco anatómico neutro
    const SELECTED_COLOR = new THREE.Color(0x38bdf8); // Celeste para la zona seleccionada

    // Asigna cada vértice de la malla 3D a su zona anatómica más cercana dentro del elipsoide
    function assignVerticesToZones(mesh) {
      const geom = mesh.geometry;
      geom.computeVertexNormals();
      const pos = geom.attributes.position;
      const count = pos.count;

      const vZone = new Int8Array(count);
      const vWeight = new Float32Array(count);
      vZone.fill(-1);

      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        let bestIdx = -1;
        let bestD2 = 1.0;

        for (let zIdx = 0; zIdx < zones.length; zIdx++) {
          const zn = zones[zIdx];
          const dx = (x - zn.center[0]) / zn.radii[0];
          const dy = (y - zn.center[1]) / zn.radii[1];
          const dz = (z - zn.center[2]) / zn.radii[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            bestIdx = zIdx;
          }
        }

        if (bestIdx !== -1) {
          vZone[i] = bestIdx;
          const d = Math.sqrt(bestD2);
          vWeight[i] = Math.min(1, Math.max(0, (1 - d * d) * 1.45));
        }

        colors[i * 3] = BASE_COLOR.r;
        colors[i * 3 + 1] = BASE_COLOR.g;
        colors[i * 3 + 2] = BASE_COLOR.b;
      }

      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.05,
      });

      meshZoneData.push({ mesh, vZone, vWeight });
    }

    // Pinta sobre la malla 3D únicamente las zonas con dolor (según escala 1..10) y la zona seleccionada
    function updateMeshZoneColors() {
      const tempColor = new THREE.Color();
      const zonePainColors = zones.map((zn) =>
        zn.status !== 'normal' && (zn.painIntensity || 0) > 0
          ? getGradualPainColor(zn.painIntensity)
          : null
      );

      meshZoneData.forEach(({ mesh, vZone, vWeight }) => {
        const colorAttr = mesh.geometry.attributes.color;
        const arr = colorAttr.array;
        const count = colorAttr.count;

        for (let i = 0; i < count; i++) {
          const zIdx = vZone[i];
          if (zIdx === -1) {
            arr[i * 3] = BASE_COLOR.r;
            arr[i * 3 + 1] = BASE_COLOR.g;
            arr[i * 3 + 2] = BASE_COLOR.b;
            continue;
          }

          const zn = zones[zIdx];
          const isSelected = zn.name.toLowerCase() === (selectedName || '').toLowerCase();
          const painColor = zonePainColors[zIdx];

          let targetColor = null;
          if (painColor) {
            targetColor = painColor;
          } else if (isSelected) {
            targetColor = SELECTED_COLOR;
          }

          if (targetColor) {
            const w = vWeight[i] * (isSelected ? 0.92 : 0.85);
            tempColor.copy(BASE_COLOR).lerp(targetColor, w);
            arr[i * 3] = tempColor.r;
            arr[i * 3 + 1] = tempColor.g;
            arr[i * 3 + 2] = tempColor.b;
          } else {
            arr[i * 3] = BASE_COLOR.r;
            arr[i * 3 + 1] = BASE_COLOR.g;
            arr[i * 3 + 2] = BASE_COLOR.b;
          }
        }
        colorAttr.needsUpdate = true;
      });
    }

    // Transición suave de cámara hacia la zona seleccionada
    let animTargetCamPos = null;
    let animTargetLookAt = null;

    function focusCameraOnZone(zn) {
      if (!zn || !zn.cameraAngles) return;
      const [azDeg, polDeg, dist] = zn.cameraAngles;
      const az = THREE.MathUtils.degToRad(azDeg);
      const pol = THREE.MathUtils.degToRad(polDeg);

      const targetY = Math.max(-0.72, Math.min(0.68, zn.center[1] * 0.72));
      animTargetLookAt = new THREE.Vector3(0, targetY, 0);

      const sinPol = Math.sin(pol);
      animTargetCamPos = new THREE.Vector3(
        dist * sinPol * Math.sin(az),
        targetY + dist * Math.cos(pol),
        dist * sinPol * Math.cos(az)
      );
      isFrontView = Math.abs(azDeg) < 90;
    }

    // Captura offscreen 3D enfocada en la zona seleccionada para mostrarla en la tarjeta de observación
    const snapSize = 192;
    const snapTarget = new THREE.WebGLRenderTarget(snapSize, snapSize);
    const snapPixels = new Uint8Array(snapSize * snapSize * 4);
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = snapSize;
    snapCanvas.height = snapSize;
    const snapCtx = snapCanvas.getContext('2d');
    const snapCamera = new THREE.PerspectiveCamera(30, 1, 0.08, 20);
    const gammaLut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      gammaLut[i] = Math.min(255, Math.round(Math.pow(i / 255, 1 / 2.15) * 255));
    }

    function captureZoneSnapshot(zn) {
      if (!zn || !zn.cameraAngles || bodyMeshes.length === 0 || !snapCtx) return;
      try {
        const [azDeg, polDeg] = zn.cameraAngles;
        const az = THREE.MathUtils.degToRad(azDeg);
        const pol = THREE.MathUtils.degToRad(polDeg);
        const zoneRadius = Math.max(zn.radii[0], zn.radii[1], zn.radii[2]);
        const closeDist = Math.max(0.48, Math.min(0.95, zoneRadius * 5.2));
        const sinPol = Math.sin(pol);
        const target = new THREE.Vector3(zn.center[0], zn.center[1], zn.center[2]);

        snapCamera.position.set(
          target.x + closeDist * sinPol * Math.sin(az),
          target.y + closeDist * Math.cos(pol),
          target.z + closeDist * sinPol * Math.cos(az)
        );
        snapCamera.lookAt(target);
        snapCamera.updateMatrixWorld();

        const prevTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(snapTarget);
        renderer.clear();
        renderer.render(scene, snapCamera);
        renderer.readRenderTargetPixels(snapTarget, 0, 0, snapSize, snapSize, snapPixels);
        renderer.setRenderTarget(prevTarget);

        const imgData = snapCtx.createImageData(snapSize, snapSize);
        const dst = imgData.data;
        const rowBytes = snapSize * 4;
        for (let y = 0; y < snapSize; y++) {
          const srcRow = (snapSize - 1 - y) * rowBytes;
          const dstRow = y * rowBytes;
          for (let x = 0; x < rowBytes; x += 4) {
            dst[dstRow + x] = gammaLut[snapPixels[srcRow + x]];
            dst[dstRow + x + 1] = gammaLut[snapPixels[srcRow + x + 1]];
            dst[dstRow + x + 2] = gammaLut[snapPixels[srcRow + x + 2]];
            dst[dstRow + x + 3] = 255;
          }
        }
        snapCtx.putImageData(imgData, 0, 0);
        postMsg({ type: 'ZONE_SNAPSHOT', zoneId: zn.id, dataUrl: snapCanvas.toDataURL('image/png') });
      } catch (e) {}
    }

    function selectZone(name, notifyParent = true) {
      selectedName = name;
      refreshPinsDOM();
      updateMeshZoneColors();
      const zn = zones.find((z) => z.name.toLowerCase() === name.toLowerCase());
      if (zn) {
        focusCameraOnZone(zn);
        captureZoneSnapshot(zn);
      }
      if (notifyParent) {
        postMsg({ type: 'SELECT_MUSCLE', name });
      }
    }

    // Controles rápidos HUD
    document.getElementById('btn-flip').addEventListener('click', (e) => {
      e.stopPropagation();
      isFrontView = !isFrontView;
      const dist = camera.position.distanceTo(controls.target);
      const targetY = controls.target.y;
      animTargetLookAt = new THREE.Vector3(0, targetY, 0);
      animTargetCamPos = new THREE.Vector3(0, targetY + 0.08, isFrontView ? dist : -dist);
    });

    document.getElementById('btn-zoom-in').addEventListener('click', (e) => {
      e.stopPropagation();
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      const newDist = Math.max(controls.minDistance, dir.length() * 0.78);
      dir.setLength(newDist);
      animTargetLookAt = controls.target.clone();
      animTargetCamPos = controls.target.clone().add(dir);
    });

    document.getElementById('btn-zoom-out').addEventListener('click', (e) => {
      e.stopPropagation();
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      const newDist = Math.min(controls.maxDistance, dir.length() * 1.25);
      dir.setLength(newDist);
      animTargetLookAt = controls.target.clone();
      animTargetCamPos = controls.target.clone().add(dir);
    });

    document.getElementById('btn-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      isFrontView = true;
      animTargetLookAt = new THREE.Vector3(0, 0, 0);
      animTargetCamPos = new THREE.Vector3(0, 0.08, 2.35);
    });

    const togglePinsBtn = document.getElementById('btn-toggle-pins');
    togglePinsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPins = !showPins;
      pinsLayer.style.opacity = showPins ? '1' : '0';
      pinsLayer.style.pointerEvents = showPins ? 'none' : 'none';
      togglePinsBtn.classList.toggle('toggled-off', !showPins);
      updatePinPositions();
    });

    // Carga del modelo 3D comprimido con Draco
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const dataUri = 'data:model/gltf-binary;base64,${MUSCLE_MODEL_BASE64}';
    gltfLoader.load(
      dataUri,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            bodyMeshes.push(child);
            assignVerticesToZones(child);
          }
        });
        scene.add(model);
        updateMeshZoneColors();

        const initZn = zones.find((z) => z.name.toLowerCase() === (selectedName || '').toLowerCase());
        if (initZn) {
          focusCameraOnZone(initZn);
          captureZoneSnapshot(initZn);
        }

        loadingEl.style.opacity = '0';
        setTimeout(() => { loadingEl.style.display = 'none'; }, 350);
      },
      undefined,
      (err) => {
        console.error('Error loading GLB:', err);
      }
    );

    // Selección directa tocando cualquier músculo sobre la malla 3D con Raycaster
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    renderer.domElement.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downTime = performance.now();
      animTargetCamPos = null;
      animTargetLookAt = null;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
      const elapsed = performance.now() - downTime;
      if (moveDist > 8 || elapsed > 400 || bodyMeshes.length === 0) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(bodyMeshes, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        let bestZone = null;
        let bestScore = 2.4;
        for (let i = 0; i < zones.length; i++) {
          const zn = zones[i];
          const dx = (pt.x - zn.center[0]) / zn.radii[0];
          const dy = (pt.y - zn.center[1]) / zn.radii[1];
          const dz = (pt.z - zn.center[2]) / zn.radii[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestScore) {
            bestScore = d2;
            bestZone = zn;
          }
        }
        if (bestZone) {
          selectZone(bestZone.name, true);
        }
      }
    });

    // Sincronización desde React Native
    window.onParentMessage = function(data) {
      if (!data || data.type !== 'SYNC_STATE') return;
      let changed = false;

      if (typeof data.locked === 'boolean') {
        controls.enabled = !data.locked;
      }

      if (data.muscles && Array.isArray(data.muscles)) {
        data.muscles.forEach((m) => {
          const zn = zones.find((z) => z.id === m.id);
          if (zn && (zn.status !== m.status || zn.painIntensity !== m.painIntensity)) {
            zn.status = m.status;
            zn.painIntensity = m.painIntensity;
            changed = true;
          }
        });
      }

      if (data.selected && data.selected.toLowerCase() !== (selectedName || '').toLowerCase()) {
        selectedName = data.selected;
        changed = true;
        const zn = zones.find((z) => z.name.toLowerCase() === selectedName.toLowerCase());
        if (zn) focusCameraOnZone(zn);
      }

      if (changed) {
        refreshPinsDOM();
        updateMeshZoneColors();
        const activeZn = zones.find((z) => z.name.toLowerCase() === (selectedName || '').toLowerCase());
        if (activeZn) captureZoneSnapshot(activeZn);
      }
    };

    window.addEventListener('message', (event) => {
      try {
        const d = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        window.onParentMessage(d);
      } catch (e) {}
    });

    const tempVec = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    function updatePinPositions() {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;

      zones.forEach((z) => {
        const btn = pinElements[z.id];
        if (!btn) return;

        if (!showPins) {
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          return;
        }

        tempVec.set(z.center[0], z.center[1], z.center[2]);
        tempNormal.set(z.normal[0], z.normal[1], z.normal[2]).normalize();
        camDir.copy(camera.position).sub(tempVec).normalize();

        const facing = tempNormal.dot(camDir);
        if (facing < 0.14) {
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          return;
        }

        tempVec.project(camera);
        const x = (tempVec.x * 0.5 + 0.5) * w;
        const y = (-tempVec.y * 0.5 + 0.5) * h;

        btn.style.left = x.toFixed(1) + 'px';
        btn.style.top = y.toFixed(1) + 'px';
        const isActive = z.name.toLowerCase() === (selectedName || '').toLowerCase();
        const hasAlert = z.status !== 'normal' && (z.painIntensity || 0) > 0;
        btn.style.opacity = isActive || hasAlert ? '1' : '0.68';
        btn.style.pointerEvents = 'auto';
      });
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      if (animTargetCamPos && animTargetLookAt) {
        camera.position.lerp(animTargetCamPos, 0.09);
        controls.target.lerp(animTargetLookAt, 0.09);
        if (camera.position.distanceTo(animTargetCamPos) < 0.02) {
          animTargetCamPos = null;
          animTargetLookAt = null;
        }
      }
      controls.update();
      renderer.render(scene, camera);
      updatePinPositions();
    }
    animate();
  </script>
</body>
</html>
  `).current;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECT_MUSCLE' && data.name) {
        onSelectMuscle(data.name);
      } else if (data.type === 'ZONE_SNAPSHOT' && data.zoneId && data.dataUrl) {
        onZoneSnapshotRef.current?.(data.zoneId, data.dataUrl);
      } else if (data.type === 'TOUCH_START') {
        onTouchStateChange?.(true);
      } else if (data.type === 'TOUCH_END') {
        onTouchStateChange?.(false);
      }
    } catch (e) {
      console.warn('Error parsing 3D viewer message', e);
    }
  };

  const containerTouchHandlers = {
    onTouchStart: () => onTouchStateChange?.(true),
    onTouchEnd: () => onTouchStateChange?.(false),
    onTouchCancel: () => onTouchStateChange?.(false),
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
  };

  if (Platform.OS === 'web' || !NativeWebView) {
    return (
      <View style={styles.container} {...containerTouchHandlers}>
        <iframe
          ref={iframeRef as any}
          srcDoc={htmlContent}
          // Anterior claro: backgroundColor: '#f8fafc'
          style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#060b19' }}
          title="Visor 3D de Anatomía Muscular"
        />
      </View>
    );
  }

  return (
    <View style={styles.container} {...containerTouchHandlers}>
      <NativeWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        onMessage={handleMessage}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#38bdf8" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 370,
    // Anterior claro: backgroundColor: '#f8fafc',
    backgroundColor: '#060b19',
    borderRadius: 20,
    overflow: 'hidden',
  },
  webView: {
    width: '100%',
    height: '100%',
    // Anterior claro: backgroundColor: '#f8fafc',
    backgroundColor: '#060b19',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    // Anterior claro: backgroundColor: '#f8fafc',
    backgroundColor: '#060b19',
  },
});
