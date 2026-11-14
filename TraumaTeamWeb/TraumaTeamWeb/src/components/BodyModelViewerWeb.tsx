import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MUSCLE_MODEL_BASE64 } from '../assets/muscle-model-base64.js';
import { getPainColorHex } from '../data/anatomy-catalog';
import type { BodyRegionCategory, MuscleData } from '../types/dashboard';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  RegionCategoryIcon,
} from './Icons';

interface BodyModelViewerWebProps {
  muscles: MuscleData[];
  selectedMuscleId: string | null;
  onSelectMuscle: (muscleId: string | null) => void;
  onZoneSnapshot?: (zoneId: string, dataUrl: string) => void;
  isLocked?: boolean;
}

const REGION_CATEGORIES: BodyRegionCategory[] = [
  'Cabeza y cuello',
  'Tronco anterior',
  'Tronco posterior',
  'Extremidad superior',
  'Cadera y pelvis',
  'Extremidad inferior',
];

function buildViewerHtml(initialMuscles: MuscleData[], initialSelectedName: string | null): string {
  const initialZonesJson = JSON.stringify(
    initialMuscles.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      painIntensity: m.observation?.painIntensity ?? 0,
      center: m.center,
      radii: m.radii,
      normal: m.normal,
      cameraAngles: m.cameraAngles,
    }))
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    html, body {
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 35%, #0f172a 0%, #060b19 72%, #020617 100%);
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      cursor: grab;
    }
    canvas:active { cursor: grabbing; }
    #pins-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      transition: opacity 0.2s ease;
    }
    #pins-layer.dragging .zone-pin {
      pointer-events: none !important;
    }
    .zone-pin {
      position: absolute;
      left: 0;
      top: 0;
      width: 24px;
      height: 24px;
      background: transparent;
      border: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      cursor: pointer;
      will-change: transform;
    }
    .zone-pin-dot {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.84);
      border: 1.5px solid rgba(100, 116, 139, 0.55);
      box-shadow: 0 1px 4px rgba(2, 6, 23, 0.45);
      transition: transform 0.14s ease, background-color 0.16s ease, border-color 0.16s ease;
    }
    .zone-pin:hover { z-index: 24; }
    .zone-pin:hover .zone-pin-dot { transform: scale(1.24); }
    .zone-pin-dot svg {
      width: 8px;
      height: 8px;
      stroke: #1e293b;
      stroke-width: 2.3;
      fill: none;
    }
    .zone-pin.has-pain .zone-pin-dot {
      width: 20px;
      height: 20px;
    }
    .zone-pin.has-pain .zone-pin-dot svg {
      width: 10px;
      height: 10px;
      stroke: #ffffff;
    }
    .zone-pin.active { z-index: 28; }
    .zone-pin.active .zone-pin-dot {
      width: 22px;
      height: 22px;
      transform: scale(1.14);
      background: #38bdf8 !important;
      border-color: #ffffff !important;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.95) !important;
    }
    .zone-pin.active .zone-pin-dot svg {
      width: 11px;
      height: 11px;
      stroke: #060b19 !important;
    }
    #hover-pill {
      position: absolute;
      left: 12px;
      bottom: 12px;
      padding: 5px 11px;
      border-radius: 999px;
      background: rgba(6, 11, 25, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.42);
      color: #e0f2fe;
      font-size: 11px;
      font-weight: 700;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.14s ease;
      z-index: 35;
    }
    #hover-pill.visible { opacity: 1; }
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
      width: 30px;
      height: 30px;
      border-radius: 9px;
      background: rgba(15, 23, 42, 0.86);
      border: 1px solid rgba(56, 189, 248, 0.36);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .ctrl-btn:hover {
      background: rgba(56, 189, 248, 0.22);
      border-color: #38bdf8;
    }
    .ctrl-btn.toggled-off { opacity: 0.55; }
    .ctrl-btn svg {
      width: 15px;
      height: 15px;
      stroke: #e2e8f0;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    #loading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #060b19;
      z-index: 100;
      transition: opacity 0.28s ease;
      font-size: 11px;
      color: #38bdf8;
      font-weight: 700;
      padding: 16px;
      text-align: center;
    }
    .spinner {
      width: 26px;
      height: 26px;
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
    <span id="loading-text">CARGANDO VISOR 3D...</span>
  </div>
  <div id="canvas-container">
    <div id="pins-layer"></div>
    <div id="hover-pill"></div>
    <div id="hud-controls">
      <button id="btn-flip" class="ctrl-btn" title="Frente / Espalda">
        <svg viewBox="0 0 24 24"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h14"/><path d="M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H3"/></svg>
      </button>
      <button id="btn-zoom-in" class="ctrl-btn" title="Acercar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button id="btn-zoom-out" class="ctrl-btn" title="Alejar">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
      <button id="btn-reset" class="ctrl-btn" title="Centrar">
        <svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button id="btn-toggle-pins" class="ctrl-btn" title="Pines">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  </div>

  <script type="module">
    const loadingEl = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    try {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');

      const pinsLayer = document.getElementById('pins-layer');
      const hoverPill = document.getElementById('hover-pill');

      const zones = ${initialZonesJson};
      let selectedName = ${JSON.stringify(initialSelectedName)};
      let showPins = true;
      let isFrontView = true;

      let viewWidth = Math.max(1, window.innerWidth);
      let viewHeight = Math.max(1, window.innerHeight);

      function postMsg(data) {
        if (window.parent) {
          window.parent.postMessage(JSON.stringify(data), '*');
        }
      }

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

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060b19);

      const starCount = 160;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 4.2 + Math.random() * 5.0;
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
        size: 0.032,
        transparent: true,
        opacity: 0.78,
        sizeAttenuation: true,
      });
      scene.add(new THREE.Points(starGeo, starMat));

      const camera = new THREE.PerspectiveCamera(38, viewWidth / viewHeight, 0.1, 20);
      camera.position.set(0, 0.06, 2.22);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(viewWidth, viewHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const container = document.getElementById('canvas-container');
      container.insertBefore(renderer.domElement, pinsLayer);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.screenSpacePanning = true;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 1.05;
      controls.panSpeed = 0.8;
      controls.minDistance = 0.85;
      controls.maxDistance = 3.2;
      controls.maxPolarAngle = Math.PI * 0.88;
      controls.minPolarAngle = Math.PI * 0.12;
      controls.target.set(0, 0.0, 0);

      scene.add(new THREE.HemisphereLight(0xf8fafc, 0x334155, 1.25));
      const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight1.position.set(1.5, 2.5, 2.5);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0x7dd3fc, 0.9);
      dirLight2.position.set(-1.5, 1.5, -2.5);
      scene.add(dirLight2);

      const ringGeo = new THREE.RingGeometry(0.32, 0.34, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const floorRing = new THREE.Mesh(ringGeo, ringMat);
      floorRing.position.y = -0.95;
      scene.add(floorRing);

      let animTargetCamPos = null;
      let animTargetLookAt = null;

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
        btn.title = z.name;
        const dot = document.createElement('span');
        dot.className = 'zone-pin-dot';
        btn.appendChild(dot);

        btn.addEventListener('mouseenter', () => {
          hoverPill.textContent = z.name + (z.painIntensity > 0 ? ' · Con síntomas' : '');
          hoverPill.classList.add('visible');
        });
        btn.addEventListener('mouseleave', () => {
          hoverPill.classList.remove('visible');
        });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectZone(z.id, true);
        });
        pinsLayer.appendChild(btn);
        pinElements[z.id] = { btn, dot, lastX: -9999, lastY: -9999, lastOp: '', lastPe: '' };
      });

      function refreshPinsDOM() {
        zones.forEach((z) => {
          const item = pinElements[z.id];
          if (!item) return;
          const { btn, dot } = item;
          const isActive =
            z.id === selectedName ||
            z.name.toLowerCase() === (selectedName || '').toLowerCase();
          const hasPain = z.status !== 'normal' && (z.painIntensity || 0) > 0;
          btn.className = 'zone-pin' + (hasPain ? ' has-pain' : '') + (isActive ? ' active' : '');
          dot.innerHTML = getPinSvg(hasPain, isActive);
          btn.title = z.name + (hasPain ? ' (Con síntomas)' : '');

          if (hasPain && !isActive) {
            const col = getGradualPainColor(z.painIntensity || 5);
            const hex = '#' + col.getHexString();
            dot.style.backgroundColor = hex;
            dot.style.borderColor = '#ffffff';
            dot.style.boxShadow = '0 0 8px ' + hex;
          } else if (!isActive) {
            dot.style.backgroundColor = '';
            dot.style.borderColor = '';
            dot.style.boxShadow = '';
          }
        });
      }
      refreshPinsDOM();

      const BASE_COLOR = new THREE.Color(0xe5e9f0);
      const SELECTED_COLOR = new THREE.Color(0x38bdf8);
      const meshZoneBuckets = [];
      let paintedZonesPrev = new Set();

      function assignVerticesToZones(mesh) {
        const geom = mesh.geometry;
        geom.computeVertexNormals();
        const pos = geom.attributes.position;
        const count = pos.count;
        const colors = new Float32Array(count * 3);

        const perZoneIndices = Array.from({ length: zones.length }, () => []);
        const perZoneWeights = Array.from({ length: zones.length }, () => []);

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
            const d = Math.sqrt(bestD2);
            perZoneIndices[bestIdx].push(i);
            perZoneWeights[bestIdx].push(Math.min(1, Math.max(0, (1 - d * d) * 1.45)));
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

        meshZoneBuckets.push({
          mesh,
          indices: perZoneIndices.map((arr) => new Uint32Array(arr)),
          weights: perZoneWeights.map((arr) => new Float32Array(arr)),
        });
      }

      function paintZoneBucket(bucket, zIdx, targetColor, strength) {
        const idxArr = bucket.indices[zIdx];
        const wArr = bucket.weights[zIdx];
        if (!idxArr || idxArr.length === 0) return;

        const colorAttr = bucket.mesh.geometry.attributes.color;
        const arr = colorAttr.array;
        const tempColor = new THREE.Color();

        for (let k = 0; k < idxArr.length; k++) {
          const vIdx = idxArr[k] * 3;
          if (!targetColor) {
            arr[vIdx] = BASE_COLOR.r;
            arr[vIdx + 1] = BASE_COLOR.g;
            arr[vIdx + 2] = BASE_COLOR.b;
          } else {
            tempColor.copy(BASE_COLOR).lerp(targetColor, wArr[k] * strength);
            arr[vIdx] = tempColor.r;
            arr[vIdx + 1] = tempColor.g;
            arr[vIdx + 2] = tempColor.b;
          }
        }
        colorAttr.needsUpdate = true;
      }

      function updateMeshZoneColors() {
        const nextPainted = new Set();

        for (let zIdx = 0; zIdx < zones.length; zIdx++) {
          const zn = zones[zIdx];
          const isSelected =
            zn.id === selectedName ||
            zn.name.toLowerCase() === (selectedName || '').toLowerCase();
          const hasPain = zn.status !== 'normal' && (zn.painIntensity || 0) > 0;

          let targetColor = null;
          if (hasPain) {
            targetColor = getGradualPainColor(zn.painIntensity);
          } else if (isSelected) {
            targetColor = SELECTED_COLOR;
          }

          if (targetColor) {
            nextPainted.add(zIdx);
            const strength = isSelected ? 0.92 : 0.85;
            meshZoneBuckets.forEach((b) => paintZoneBucket(b, zIdx, targetColor, strength));
          } else if (paintedZonesPrev.has(zIdx)) {
            meshZoneBuckets.forEach((b) => paintZoneBucket(b, zIdx, null, 0));
          }
        }

        paintedZonesPrev = nextPainted;
      }

      // Captura offscreen 3D enfocada en la zona seleccionada para mostrarla en el panel de detalle
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
        if (!zn || !zn.cameraAngles || meshZoneBuckets.length === 0 || !snapCtx) return;
        try {
          const [azDeg, polDeg] = zn.cameraAngles;
          const az = THREE.MathUtils.degToRad(azDeg);
          const pol = THREE.MathUtils.degToRad(polDeg);
          const zoneRadius = Math.max(zn.radii[0], zn.radii[1], zn.radii[2]);
          const closeDist = Math.max(0.48, Math.min(0.95, zoneRadius * 5.2));
          const sinPol = Math.sin(pol);
          const targetX = zn.center[0];
          const targetY = zn.center[1];
          const targetZ = zn.center[2];

          snapCamera.position.set(
            targetX + closeDist * sinPol * Math.sin(az),
            targetY + closeDist * Math.cos(pol),
            targetZ + closeDist * sinPol * Math.cos(az)
          );
          snapCamera.lookAt(targetX, targetY, targetZ);
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
        } catch {}
      }

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

      function findZone(idOrName) {
        if (!idOrName) return null;
        const lower = String(idOrName).toLowerCase();
        return zones.find((z) => z.id === idOrName || z.name.toLowerCase() === lower) || null;
      }

      function selectZone(idOrName, notifyParent = true) {
        const zn = findZone(idOrName);
        selectedName = zn ? zn.id : idOrName;
        refreshPinsDOM();
        updateMeshZoneColors();
        if (zn) {
          focusCameraOnZone(zn);
          captureZoneSnapshot(zn);
          if (notifyParent) postMsg({ type: 'SELECT_MUSCLE', id: zn.id, name: zn.name });
        }
      }

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
        animTargetCamPos = new THREE.Vector3(0, 0.06, 2.22);
        if (selectedName !== null) {
          selectedName = null;
          refreshPinsDOM();
          updateMeshZoneColors();
          postMsg({ type: 'SELECT_MUSCLE', id: null, name: null });
        }
      });

      const togglePinsBtn = document.getElementById('btn-toggle-pins');
      togglePinsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPins = !showPins;
        pinsLayer.style.opacity = showPins ? '1' : '0';
        togglePinsBtn.classList.toggle('toggled-off', !showPins);
      });

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
              assignVerticesToZones(child);
            }
          });
          scene.add(model);
          updateMeshZoneColors();

          const initZn = findZone(selectedName);
          if (initZn) {
            focusCameraOnZone(initZn);
            captureZoneSnapshot(initZn);
          }

          loadingEl.style.opacity = '0';
          setTimeout(() => { loadingEl.style.display = 'none'; }, 280);
          postMsg({ type: 'VIEWER_READY' });
        },
        undefined,
        () => {
          loadingText.textContent = 'Visor 3D no disponible';
        }
      );

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const tmpNormal = new THREE.Vector3();
      const tmpToCam = new THREE.Vector3();
      let isPointerDown = false;
      let downX = 0;
      let downY = 0;
      let downTime = 0;
      let lastHoverMove = 0;

      // Intersección analítica rayo-elipsoide sobre las 40 zonas (<0.02 ms) sin raycast pesado sobre triángulos
      function pickZoneAnalytic(clientX, clientY, maxScale2) {
        pointer.x = (clientX / viewWidth) * 2 - 1;
        pointer.y = -(clientY / viewHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const ro = raycaster.ray.origin;
        const rd = raycaster.ray.direction;

        let bestZone = null;
        let bestDepth = Infinity;

        for (let i = 0; i < zones.length; i++) {
          const zn = zones[i];
          const ox = (ro.x - zn.center[0]) / zn.radii[0];
          const oy = (ro.y - zn.center[1]) / zn.radii[1];
          const oz = (ro.z - zn.center[2]) / zn.radii[2];

          const dx = rd.x / zn.radii[0];
          const dy = rd.y / zn.radii[1];
          const dz = rd.z / zn.radii[2];

          const dd = dx * dx + dy * dy + dz * dz;
          if (dd <= 1e-6) continue;

          const t = Math.max(0, -(ox * dx + oy * dy + oz * dz) / dd);
          const px = ox + dx * t;
          const py = oy + dy * t;
          const pz = oz + dz * t;
          const d2 = px * px + py * py + pz * pz;

          if (d2 <= maxScale2) {
            tmpNormal.set(zn.normal[0], zn.normal[1], zn.normal[2]).normalize();
            tmpToCam.set(camera.position.x - zn.center[0], camera.position.y - zn.center[1], camera.position.z - zn.center[2]).normalize();
            if (tmpNormal.dot(tmpToCam) < -0.05) continue;

            if (t < bestDepth) {
              bestDepth = t;
              bestZone = zn;
            }
          }
        }
        return bestZone;
      }

      renderer.domElement.addEventListener('pointerdown', (e) => {
        isPointerDown = true;
        pinsLayer.classList.add('dragging');
        downX = e.clientX;
        downY = e.clientY;
        downTime = performance.now();
        animTargetCamPos = null;
        animTargetLookAt = null;
      });

      renderer.domElement.addEventListener('pointermove', (e) => {
        if (isPointerDown || meshZoneBuckets.length === 0) return;
        const now = performance.now();
        if (now - lastHoverMove < 40) return;
        lastHoverMove = now;

        const bestZone = pickZoneAnalytic(e.clientX, e.clientY, 1.35);
        if (bestZone) {
          renderer.domElement.style.cursor = 'pointer';
          hoverPill.textContent = bestZone.name + (bestZone.painIntensity > 0 ? ' · Con síntomas' : '');
          hoverPill.classList.add('visible');
        } else {
          renderer.domElement.style.cursor = 'grab';
          hoverPill.classList.remove('visible');
        }
      });

      function endDrag() {
        isPointerDown = false;
        pinsLayer.classList.remove('dragging');
      }

      renderer.domElement.addEventListener('pointerup', (e) => {
        endDrag();
        const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
        const elapsed = performance.now() - downTime;
        if (moveDist > 8 || elapsed > 450 || meshZoneBuckets.length === 0) return;

        const bestZone = pickZoneAnalytic(e.clientX, e.clientY, 1.6);
        if (bestZone) selectZone(bestZone.id, true);
      });

      renderer.domElement.addEventListener('pointercancel', endDrag);
      window.addEventListener('pointerup', endDrag);

      window.onParentMessage = function(data) {
        if (!data || data.type !== 'SYNC_STATE') return;
        let changed = false;
        if (typeof data.locked === 'boolean') controls.enabled = !data.locked;
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
        if (data.selected !== undefined && data.selected !== selectedName) {
          selectedName = data.selected;
          changed = true;
          const zn = findZone(selectedName);
          if (zn) {
            focusCameraOnZone(zn);
          } else {
            isFrontView = true;
            animTargetLookAt = new THREE.Vector3(0, 0, 0);
            animTargetCamPos = new THREE.Vector3(0, 0.06, 2.22);
          }
        }
        if (changed) {
          refreshPinsDOM();
          updateMeshZoneColors();
          const activeZn = findZone(selectedName);
          if (activeZn) captureZoneSnapshot(activeZn);
        }
      };

      window.addEventListener('message', (event) => {
        try {
          window.onParentMessage(typeof event.data === 'string' ? JSON.parse(event.data) : event.data);
        } catch {}
      });

      const tempVec = new THREE.Vector3();
      const tempNormal = new THREE.Vector3();
      const camDir = new THREE.Vector3();

      function updatePinPositions() {
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i];
          const item = pinElements[z.id];
          if (!item) continue;
          const btn = item.btn;

          if (!showPins) {
            if (item.lastOp !== '0') {
              btn.style.opacity = '0';
              item.lastOp = '0';
            }
            if (item.lastPe !== 'none') {
              btn.style.pointerEvents = 'none';
              item.lastPe = 'none';
            }
            continue;
          }

          tempVec.set(z.center[0], z.center[1], z.center[2]);
          tempNormal.set(z.normal[0], z.normal[1], z.normal[2]).normalize();
          camDir.copy(camera.position).sub(tempVec).normalize();

          if (tempNormal.dot(camDir) < 0.14) {
            if (item.lastOp !== '0') {
              btn.style.opacity = '0';
              item.lastOp = '0';
            }
            if (item.lastPe !== 'none') {
              btn.style.pointerEvents = 'none';
              item.lastPe = 'none';
            }
            continue;
          }

          tempVec.project(camera);
          const xPx = (tempVec.x * 0.5 + 0.5) * viewWidth;
          const yPx = (-tempVec.y * 0.5 + 0.5) * viewHeight;

          if (Math.abs(xPx - item.lastX) > 0.25 || Math.abs(yPx - item.lastY) > 0.25) {
            item.lastX = xPx;
            item.lastY = yPx;
            btn.style.transform =
              'translate3d(' + xPx.toFixed(1) + 'px,' + yPx.toFixed(1) + 'px,0) translate(-50%,-50%)';
          }

          const isActive = z.id === selectedName || z.name.toLowerCase() === (selectedName || '').toLowerCase();
          const hasAlert = z.status !== 'normal' && (z.painIntensity || 0) > 0;
          const nextOp = isActive || hasAlert ? '1' : '0.76';
          if (item.lastOp !== nextOp) {
            btn.style.opacity = nextOp;
            item.lastOp = nextOp;
          }
          if (item.lastPe !== 'auto') {
            btn.style.pointerEvents = 'auto';
            item.lastPe = 'auto';
          }
        }
      }

      window.addEventListener('resize', () => {
        viewWidth = Math.max(1, window.innerWidth);
        viewHeight = Math.max(1, window.innerHeight);
        camera.aspect = viewWidth / viewHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewWidth, viewHeight);
      });

      let rafId = 0;
      function animate() {
        if (document.hidden) {
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(animate);

        if (animTargetCamPos && animTargetLookAt) {
          camera.position.lerp(animTargetCamPos, 0.12);
          controls.target.lerp(animTargetLookAt, 0.12);
          if (camera.position.distanceTo(animTargetCamPos) < 0.018) {
            camera.position.copy(animTargetCamPos);
            controls.target.copy(animTargetLookAt);
            animTargetCamPos = null;
            animTargetLookAt = null;
          }
        }

        controls.update();
        renderer.render(scene, camera);
        updatePinPositions();
      }

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !rafId) {
          animate();
        }
      });

      animate();
    } catch {
      loadingText.textContent = 'Visor WebGL no disponible';
    }
  </script>
</body>
</html>`;
}

export const BodyModelViewerWeb: React.FC<BodyModelViewerWebProps> = ({
  muscles,
  selectedMuscleId,
  onSelectMuscle,
  onZoneSnapshot,
  isLocked = false,
}) => {
  const selectId = useId();
  const listboxId = useId();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const onSelectRef = useRef(onSelectMuscle);
  const onZoneSnapshotRef = useRef(onZoneSnapshot);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectMuscle;
  }, [onSelectMuscle]);

  useEffect(() => {
    onZoneSnapshotRef.current = onZoneSnapshot;
  }, [onZoneSnapshot]);

  const [srcDoc] = useState(() => buildViewerHtml(muscles, selectedMuscleId));
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'VIEWER_READY') {
          setViewerReady(true);
        } else if (
          data.type === 'SELECT_MUSCLE' &&
          (typeof data.id === 'string' || data.id === null)
        ) {
          onSelectRef.current(data.id);
        } else if (
          data.type === 'ZONE_SNAPSHOT' &&
          typeof data.zoneId === 'string' &&
          typeof data.dataUrl === 'string'
        ) {
          onZoneSnapshotRef.current?.(data.zoneId, data.dataUrl);
        }
      } catch {
        // Ignorar mensajes externos
      }
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      type: 'SYNC_STATE',
      selected: selectedMuscleId,
      locked: isLocked,
      muscles: muscles.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        painIntensity: m.observation?.painIntensity ?? 0,
      })),
    });
    iframeRef.current?.contentWindow?.postMessage(payload, '*');
  }, [muscles, selectedMuscleId, isLocked, viewerReady]);

  const affectedMuscles = useMemo(
    () =>
      muscles
        .filter((m) => m.status !== 'normal' && (m.observation?.painIntensity ?? 0) > 0)
        .sort(
          (a, b) => (b.observation?.painIntensity ?? 0) - (a.observation?.painIntensity ?? 0)
        ),
    [muscles]
  );

  const groupedByCategory = useMemo(
    () =>
      REGION_CATEGORIES.map((category) => ({
        category,
        items: muscles.filter((m) => m.category === category),
      })),
    [muscles]
  );

  const selectedMuscle = useMemo(
    () => (selectedMuscleId ? muscles.find((m) => m.id === selectedMuscleId) ?? null : null),
    [muscles, selectedMuscleId]
  );

  useEffect(() => {
    if (!dropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerWrapRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleWindowBlur = () => setDropdownOpen(false);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dropdownOpen]);

  const handleChooseMuscle = (muscleId: string | null) => {
    onSelectMuscle(muscleId);
    setDropdownOpen(false);
  };

  const selectedHasSymptom =
    selectedMuscle !== null &&
    selectedMuscle.status !== 'normal' &&
    Boolean(selectedMuscle.observation);
  const selectedPain = selectedMuscle?.observation?.painIntensity ?? 0;
  const selectedPainColor = getPainColorHex(selectedPain);

  return (
    <div className="viewer3d-wrapper">
      <div className="viewer3d-dropdown-bar">
        <div ref={pickerWrapRef} className="viewer3d-select-field">
          <span id={selectId} className="viewer3d-select-label">
            Músculo / Zona 3D
          </span>
          <button
            ref={triggerRef}
            type="button"
            className={`muscle-picker-trigger ${dropdownOpen ? 'is-open' : ''}`}
            aria-labelledby={selectId}
            aria-expanded={dropdownOpen}
            aria-controls={listboxId}
            onClick={() => setDropdownOpen((open) => !open)}
          >
            <span className="muscle-picker-trigger-left">
              {selectedMuscle ? (
                selectedHasSymptom ? (
                  <span
                    className="muscle-option-icon is-affected"
                    style={{
                      backgroundColor: '#060b19',
                      borderColor: selectedPainColor,
                      color: selectedPainColor,
                      boxShadow: `0 0 8px -1px ${selectedPainColor}80`,
                    }}
                    aria-hidden="true"
                  >
                    <AlertTriangleIcon size={12} strokeWidth={2.3} />
                  </span>
                ) : (
                  <span className="muscle-option-icon is-normal" aria-hidden="true">
                    <RegionCategoryIcon category={selectedMuscle.category} size={12} />
                  </span>
                )
              ) : (
                <span className="muscle-option-icon is-idle" aria-hidden="true">
                  <ActivityIcon size={12} />
                </span>
              )}

              <span className="muscle-picker-trigger-text">
                {selectedMuscle
                  ? selectedMuscle.name
                  : '— Seleccionar músculo o zona —'}
              </span>
            </span>

            <ChevronDownIcon
              size={15}
              className={`muscle-picker-chevron ${dropdownOpen ? 'rotated' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={selectId}
              className="muscle-picker-menu"
            >
              <button
                type="button"
                role="option"
                aria-selected={selectedMuscleId === null}
                className={`muscle-picker-option ${selectedMuscleId === null ? 'is-selected' : ''}`}
                onClick={() => handleChooseMuscle(null)}
              >
                <span className="muscle-option-icon is-idle" aria-hidden="true">
                  <ActivityIcon size={12} />
                </span>
                <span className="muscle-option-copy">
                  <strong>— Seleccionar músculo o zona —</strong>
                </span>
                {selectedMuscleId === null && (
                  <CheckIcon size={14} className="muscle-option-check" />
                )}
              </button>

              {affectedMuscles.length > 0 && (
                <div className="muscle-picker-group">
                  <div className="muscle-picker-group-label">
                    Con síntomas reportados ({affectedMuscles.length})
                  </div>
                  {affectedMuscles.map((m) => {
                    const pain = m.observation?.painIntensity ?? 0;
                    const painColor = getPainColorHex(pain);
                    const isSelected = selectedMuscleId === m.id;
                    return (
                      <button
                        key={`active-${m.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`muscle-picker-option is-affected-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleChooseMuscle(m.id)}
                      >
                        <span
                          className="muscle-option-icon is-affected"
                          style={{
                            backgroundColor: '#060b19',
                            borderColor: painColor,
                            color: painColor,
                            boxShadow: `0 0 8px -1px ${painColor}80`,
                          }}
                          aria-hidden="true"
                        >
                          <AlertTriangleIcon size={12} strokeWidth={2.3} />
                        </span>
                        <span className="muscle-option-copy">
                          <strong>{m.name}</strong>
                          <small>{m.observation?.conditionName || m.category}</small>
                        </span>
                        <span
                          className="muscle-option-pain-pill"
                          style={{
                            backgroundColor: '#060b19',
                            borderColor: `${painColor}88`,
                            color: painColor,
                          }}
                        >
                          <span
                            className="muscle-option-pain-dot"
                            style={{ backgroundColor: painColor }}
                          />
                          {pain}/10
                        </span>
                        {isSelected && (
                          <CheckIcon size={14} className="muscle-option-check" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {groupedByCategory.map((group) => (
                <div key={group.category} className="muscle-picker-group">
                  <div className="muscle-picker-group-label">{group.category}</div>
                  {group.items.map((m) => {
                    const hasSym = m.status !== 'normal' && Boolean(m.observation);
                    const pain = m.observation?.painIntensity ?? 0;
                    const painColor = getPainColorHex(pain);
                    const isSelected = selectedMuscleId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`muscle-picker-option ${hasSym ? 'is-affected-row' : ''} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleChooseMuscle(m.id)}
                      >
                        {hasSym ? (
                          <span
                            className="muscle-option-icon is-affected"
                            style={{
                              backgroundColor: '#060b19',
                              borderColor: painColor,
                              color: painColor,
                              boxShadow: `0 0 8px -1px ${painColor}80`,
                            }}
                            aria-hidden="true"
                          >
                            <AlertTriangleIcon size={12} strokeWidth={2.3} />
                          </span>
                        ) : (
                          <span className="muscle-option-icon is-normal" aria-hidden="true">
                            <RegionCategoryIcon category={m.category} size={12} />
                          </span>
                        )}
                        <span className="muscle-option-copy">
                          <strong>{m.name}</strong>
                          {hasSym && <small>Con síntomas · {pain}/10</small>}
                        </span>
                        {hasSym && (
                          <span
                            className="muscle-option-pain-dot only"
                            style={{ backgroundColor: painColor }}
                            aria-hidden="true"
                          />
                        )}
                        {isSelected && (
                          <CheckIcon size={14} className="muscle-option-check" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className={`viewer3d-alert-pill ${affectedMuscles.length > 0 ? 'has-alerts' : ''}`}>
          {affectedMuscles.length > 0
            ? `${affectedMuscles.length} con síntomas`
            : 'Sin alertas'}
        </span>
      </div>

      <div className="viewer3d-canvas-frame">
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          title="Visor 3D TraumaTeam"
          className="viewer3d-iframe"
        />
      </div>

      <div className="viewer3d-pain-legend" aria-label="Escala visual de dolor y zona activa">
        <div className="vpl-bar" />
        <div className="vpl-labels">
          <span>
            <i className="vpl-dot" style={{ backgroundColor: '#fde047' }} /> 1 Leve
          </span>
          <span>
            <i className="vpl-dot" style={{ backgroundColor: '#f97316' }} /> 5 Moderado
          </span>
          <span>
            <i className="vpl-dot" style={{ backgroundColor: '#991b1b' }} /> 10 Intenso
          </span>
        </div>
      </div>
    </div>
  );
};
