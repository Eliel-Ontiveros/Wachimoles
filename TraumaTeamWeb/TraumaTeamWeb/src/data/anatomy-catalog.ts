import type {
  AstronautProfile,
  BodyConditionRecord,
  BodyRegionCategory,
  DailyHealthCheck,
  GlobalAiRagInsight,
  MuscleAiRecommendation,
  MuscleData,
  MuscleMedicalKnowledge,
  RiskTier,
  VitalSignsData,
} from '../types/dashboard';

export const PRIMARY_ASTRONAUT: AstronautProfile = {
  id: 'eliel-alfonso',
  userId: import.meta.env.EXPO_PUBLIC_USER_ID || '',
  name: 'Eliel Alfonso',
  shortName: 'E. Alfonso',
  code: 'ASTRO-01',
  role: 'Astronauta · Sujeto Activo',
  specialty: 'Telemetría biomédica móvil + smartwatch',
  origin: 'tierra',
  destination: 'luna',
  environment: 'nave',
  gravityLabel: '0g Microgravedad',
  isPrimary: true,
};

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

export function getRiskTierFromIntensity(intensity?: number): RiskTier {
  if (!intensity || intensity <= 0) return 'normal';
  if (intensity <= 3) return 'yellow';
  if (intensity <= 6) return 'orange';
  return 'red';
}

export function getRiskTierMeta(tier: RiskTier): {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (tier) {
    case 'yellow':
      return {
        label: 'Riesgo Leve · Amarillo',
        shortLabel: 'Amarillo',
        color: '#ca8a04',
        bg: 'rgba(250, 204, 21, 0.16)',
        border: 'rgba(234, 179, 8, 0.55)',
      };
    case 'orange':
      return {
        label: 'Riesgo Moderado · Naranja',
        shortLabel: 'Naranja',
        color: '#ea580c',
        bg: 'rgba(249, 115, 22, 0.16)',
        border: 'rgba(249, 115, 22, 0.55)',
      };
    case 'red':
      return {
        label: 'Riesgo Grave · Rojo',
        shortLabel: 'Rojo Crítico',
        color: '#dc2626',
        bg: 'rgba(239, 68, 68, 0.18)',
        border: 'rgba(239, 68, 68, 0.65)',
      };
    default:
      return {
        label: 'Nominal · Sin lesión',
        shortLabel: 'Nominal',
        color: '#0284c7',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.35)',
      };
  }
}

export function getPainSeverityLabel(intensity: number): string {
  if (intensity <= 0) return 'Nominal';
  if (intensity <= 3) return 'Leve (Amarillo)';
  if (intensity <= 6) return 'Moderado (Naranja)';
  if (intensity <= 8) return 'Severo (Rojo)';
  return 'Crítico (Rojo intenso)';
}

// Catálogo exacto de zonas anatómicas 3D sincronizado con TraumaTeamMovil
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
    center: [-0.085, 0.4, 0.085],
    radii: [0.09, 0.095, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [-12, 78, 1.85],
  },
  {
    id: 'pectoral_izq',
    name: 'Pectoral izquierdo',
    category: 'Tronco anterior',
    status: 'normal',
    center: [0.085, 0.4, 0.085],
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
    radii: [0.1, 0.135, 0.07],
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
    radii: [0.115, 0.1, 0.08],
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
    center: [-0.3, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, 0.8],
    cameraAngles: [-35, 80, 1.85],
  },
  {
    id: 'biceps_izq',
    name: 'Bíceps izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.3, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [0.6, 0, 0.8],
    cameraAngles: [35, 80, 1.85],
  },
  {
    id: 'triceps_der',
    name: 'Tríceps derecho',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.29, 0.3, -0.06],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, -0.8],
    cameraAngles: [-145, 80, 1.85],
  },
  {
    id: 'triceps_izq',
    name: 'Tríceps izquierdo',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.29, 0.3, -0.06],
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
    center: [-0.175, -0.9, 0.025],
    radii: [0.08, 0.075, 0.14],
    normal: [0, 0.35, 1],
    cameraAngles: [-15, 82, 1.65],
  },
  {
    id: 'pie_izq',
    name: 'Pie izquierdo',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.175, -0.9, 0.025],
    radii: [0.08, 0.075, 0.14],
    normal: [0, 0.35, 1],
    cameraAngles: [15, 82, 1.65],
  },
];

const REGION_KNOWLEDGE_TEMPLATE: Record<BodyRegionCategory, MuscleMedicalKnowledge> = {
  'Cabeza y cuello': {
    anatomicalSummary: 'Musculatura cervical, base craneal y región facial.',
    biomechanicalRole: 'Sostiene la cabeza y absorbe carga del casco EVA.',
    spaceflightImpact: 'Fluido cefálico en 0g y tensión cervical por casco.',
    keyStructures: ['Esternocleidomastoideo', 'Suboccipitales', 'C1–C7'],
    preventiveCountermeasure: 'Isométricos cervicales suaves e hidratación constante.',
    yellowProtocol: 'Movilidad cervical suave y vigilar presión arterial.',
    redProtocol: 'Descartar trauma o SANS; limitar actividad EVA.',
    ragReferences: [
      {
        title: 'SANS & Fluid Shifts',
        source: 'NASA HRP',
        focus: 'Edema y presión cefálica 0g',
      },
      {
        title: 'Cervical Spine Adaptation',
        source: 'Aerospace Med',
        focus: 'Sobrecarga cervical',
      },
    ],
  },
  'Tronco anterior': {
    anatomicalSummary: 'Pared torácica anterior y faja abdominal estabilizadora.',
    biomechanicalRole: 'Estabiliza el tórax y coordina empuje/tracción 0g.',
    spaceflightImpact: 'Pérdida de tono postural y sobrecarga en traslación.',
    keyStructures: ['Pectoral mayor', 'Recto abdominal', 'Oblicuos'],
    preventiveCountermeasure: 'Activación progresiva de core sin hiperpresión.',
    yellowProtocol: 'Reducir carga de tren superior 24–48 h.',
    redProtocol: 'Descartar origen cardiopulmonar con ECG y SpO2.',
    ragReferences: [
      {
        title: 'Core Stabilization in 0g',
        source: 'J. Appl. Physiol.',
        focus: 'Atrofia abdominal en órbita',
      },
      {
        title: 'Thoracic Triage Protocol',
        source: 'NASA Medical',
        focus: 'Dolor pectoral vs cardíaco',
      },
    ],
  },
  'Tronco posterior': {
    anatomicalSummary: 'Cadena dorsal profunda, erectores espinales y zona lumbar.',
    biomechanicalRole: 'Estabiliza la columna toracolumbar y transfiere fuerza.',
    spaceflightImpact: 'Expansión discal en 0g (+2–5 cm) y lumbalgia frecuente.',
    keyStructures: ['Dorsal ancho', 'Multífidos', 'Discos L1–S1'],
    preventiveCountermeasure: 'Flexión lumbar suave y control de carga axial ARED.',
    yellowProtocol: 'Descarga lumbar, calor moderado y pausar ARED.',
    redProtocol: 'Sospecha radicular: suspender ARED/EVA y monitorear.',
    ragReferences: [
      {
        title: 'Spaceflight Disc Swelling',
        source: 'NASA HRP',
        focus: 'Elongación espinal y lumbalgia',
      },
      {
        title: 'Lumbar Multifidus Study',
        source: 'Eur Spine J',
        focus: 'Protección lumbar post-vuelo',
      },
    ],
  },
  'Extremidad superior': {
    anatomicalSummary: 'Hombro, brazo, antebrazo y musculatura de agarre.',
    biomechanicalRole: 'Motor principal de traslación y sujeción en microgravedad.',
    spaceflightImpact: 'Fatiga de manguito rotador y trauma por guante EVA.',
    keyStructures: ['Deltoides', 'Bíceps / Tríceps', 'Tendones del carpo'],
    preventiveCountermeasure: 'Alternar agarre en pasamanos y estirar antebrazos.',
    yellowProtocol: 'Reposo relativo y foto diaria si hay lesión cutánea.',
    redProtocol: 'Inmovilización parcial; suspender tareas EVA de agarre.',
    ragReferences: [
      {
        title: 'EVA Glove Trauma Surveillance',
        source: 'NASA EVA Lab',
        focus: 'Fatiga de agarre y lesiones EVA',
      },
      {
        title: 'Rotator Cuff in Microgravity',
        source: 'Aerospace Med',
        focus: 'Sobrecarga manual 0g',
      },
    ],
  },
  'Cadera y pelvis': {
    anatomicalSummary: 'Glúteos estabilizadores, abductores y articulación coxofemoral.',
    biomechanicalRole: 'Estabilidad lateral pélvica y extensión de cadera.',
    spaceflightImpact: 'Pérdida ósea en cuello femoral y atrofia sin ARED.',
    keyStructures: ['Glúteo mayor/medio', 'Banda iliotibial', 'Cuello femoral'],
    preventiveCountermeasure: 'Sentadilla asistida ARED y estiramiento lateral.',
    yellowProtocol: 'Bajar resistencia 40% y vigilar dolor irradiado.',
    redProtocol: 'Suspender carga axial ARED/T2 y evaluar tendón/ciático.',
    ragReferences: [
      {
        title: 'Femoral Neck & Gluteus Countermeasures',
        source: 'NASA Muscle Lab',
        focus: 'Carga pélvica en órbita',
      },
    ],
  },
  'Extremidad inferior': {
    anatomicalSummary: 'Cuádriceps, isquiotibiales, gemelos, sóleo y pie.',
    biomechanicalRole: 'Soporte antigravitatorio, carrera T2 y retorno venoso.',
    spaceflightImpact: 'Atrofia acelerada (sóleo/gemelos) y estasis venoso 0g.',
    keyStructures: ['Cuádriceps', 'Gemelos y sóleo', 'Tendón de Aquiles'],
    preventiveCountermeasure: 'Caminadora T2 con arnés y revisión cutánea diaria.',
    yellowProtocol: 'Bajar ritmo en caminadora T2 y vigilar edema.',
    redProtocol: 'Suspender T2; si hay hinchazón unilateral, descartar TVP.',
    ragReferences: [
      {
        title: 'Calf Atrophy in Orbit',
        source: 'NASA HRP',
        focus: 'Desacondicionamiento de pantorrilla',
      },
      {
        title: 'Spaceflight Venous Thrombosis',
        source: 'NEJM / NASA',
        focus: 'Vigilancia vascular miembro inferior',
      },
    ],
  },
};

const SPECIFIC_MUSCLE_OVERRIDES: Record<string, Partial<MuscleMedicalKnowledge>> = {
  cara: {
    anatomicalSummary: 'Región facial, senos paranasales y musculatura mímica.',
    spaceflightImpact: 'Congestión por fluidos en 0g y roce de mascarilla.',
  },
  cabeza: {
    anatomicalSummary: 'Cráneo, cuero cabelludo y región temporo-occipital.',
    spaceflightImpact: 'Golpes contra mamparos y cefalea por CO2 / fluidos.',
  },
  cuello: {
    anatomicalSummary: 'Columna cervical anterior/lateral y esternocleidomastoideo.',
    spaceflightImpact: 'Sobrecarga por anillo del casco EVA y giros en 0g.',
  },
  trapecio: {
    anatomicalSummary: 'Trapecio superior/medio y zona suboccipital de nuca.',
    spaceflightImpact: 'Tensión postural frente a consolas sin apoyo.',
  },
  lumbar: {
    anatomicalSummary: 'Paravertebrales lumbares, multífidos y segmentos L1–L5.',
    spaceflightImpact: 'Zona #1 de dolor en órbita por expansión discal 0g.',
  },
  gemelo_der: {
    anatomicalSummary: 'Gastrocnemio derecho, sóleo y tendón de Aquiles.',
    spaceflightImpact: 'Alta atrofia 0g; foco clave de vigilancia vascular.',
  },
  gemelo_izq: {
    anatomicalSummary: 'Gastrocnemio izquierdo, sóleo y tendón de Aquiles.',
    spaceflightImpact: 'Alta atrofia 0g; foco clave de vigilancia vascular.',
  },
  mano_der: {
    anatomicalSummary: 'Musculatura palmar, tendones flexores y piel de mano derecha.',
    spaceflightImpact: 'Fatiga de agarre y rozaduras por guante presurizado.',
  },
  mano_izq: {
    anatomicalSummary: 'Musculatura palmar, tendones flexores y piel de mano izquierda.',
    spaceflightImpact: 'Fatiga de agarre y rozaduras por guante presurizado.',
  },
};

export function getMuscleKnowledge(muscle: MuscleData): MuscleMedicalKnowledge {
  const base = REGION_KNOWLEDGE_TEMPLATE[muscle.category];
  const specific = SPECIFIC_MUSCLE_OVERRIDES[muscle.id];
  if (!specific) return base;
  return { ...base, ...specific };
}

export function evaluateMuscleWithAiRag(
  muscle: MuscleData,
  vitals: VitalSignsData,
  latestCheck: DailyHealthCheck | null
): MuscleAiRecommendation {
  const knowledge = getMuscleKnowledge(muscle);
  const obs = muscle.observation;
  const intensity = obs?.painIntensity ?? 0;
  const riskTier = getRiskTierFromIntensity(intensity);
  const riskMeta = getRiskTierMeta(riskTier);

  const differentialWarnings: string[] = [];
  const recommendedActions: string[] = [];
  const telemetryCorrelations: string[] = [];

  if (!obs || intensity === 0) {
    recommendedActions.push(knowledge.preventiveCountermeasure);
  } else {
    if (riskTier === 'red') {
      differentialWarnings.push(`Dolor grave (${intensity}/10): restringir carga.`);
      recommendedActions.push(knowledge.redProtocol);
    } else if (riskTier === 'orange') {
      differentialWarnings.push(`Dolor moderado (${intensity}/10): posible sobrecarga.`);
      recommendedActions.push(knowledge.yellowProtocol);
    } else {
      differentialWarnings.push(`Molestia leve (${intensity}/10): fase temprana.`);
      recommendedActions.push(knowledge.yellowProtocol);
    }

    if (obs.swelling) {
      differentialWarnings.push('Edema reportado: vigilar evolución.');
      if (muscle.id.startsWith('gemelo') || muscle.id.startsWith('muslo')) {
        differentialWarnings.push('Alerta vascular: descartar estasis o TVP.');
      }
      recommendedActions.push('Capturar foto diaria para medir evolución.');
    }

    if (obs.functionalLimitation) {
      differentialWarnings.push('Limitación funcional: pausar ARED / T2.');
    }
  }

  if (vitals.heartRate !== null) {
    if (vitals.heartRate >= 105) {
      telemetryCorrelations.push(`Pulso elevado (${vitals.heartRate} Lpm).`);
    } else {
      telemetryCorrelations.push(`Pulso basal (${vitals.heartRate} Lpm).`);
    }
  }

  if (vitals.stress !== null) {
    if (vitals.stress >= 70) {
      telemetryCorrelations.push(`Estrés alto (${vitals.stress}/100).`);
      recommendedActions.push('Aplicar respiración guiada 10 min.');
    } else {
      telemetryCorrelations.push(`Estrés en ${vitals.stress}/100.`);
    }
  }

  if (vitals.spo2 !== null && vitals.spo2 < 94) {
    telemetryCorrelations.push(`SpO2 límite (${vitals.spo2}%).`);
  }

  if (vitals.sleepHours !== null && vitals.sleepHours < 6.5) {
    telemetryCorrelations.push(`Sueño bajo (${vitals.sleepHours.toFixed(1)} h).`);
  }

  if (latestCheck) {
    if (latestCheck.temperatureC !== null && latestCheck.temperatureC >= 37.5) {
      telemetryCorrelations.push(`Temp. ${latestCheck.temperatureC}°C en check-in.`);
    }
    if (latestCheck.symptoms.length > 0 && !latestCheck.symptoms.includes('Ninguno')) {
      telemetryCorrelations.push(`Síntomas: ${latestCheck.symptoms.join(', ')}.`);
    }
  }

  let clinicalSummary = `${muscle.name}: estado nominal sin alerta activa.`;
  if (obs && intensity > 0) {
    clinicalSummary = `${muscle.name} · Riesgo ${getPainSeverityLabel(intensity)} (${intensity}/10)${
      obs.swelling ? ' · Con hinchazón' : ''
    }${obs.functionalLimitation ? ' · Limitación' : ''}.`;
  }

  return {
    muscleId: muscle.id,
    muscleName: muscle.name,
    riskTier,
    riskLabel: riskMeta.label,
    clinicalSummary,
    differentialWarnings,
    recommendedActions,
    telemetryCorrelations,
    references: knowledge.ragReferences,
  };
}

export function generateGlobalAiRagInsights(
  vitals: VitalSignsData,
  conditions: BodyConditionRecord[],
  healthChecks: DailyHealthCheck[]
): GlobalAiRagInsight[] {
  const insights: GlobalAiRagInsight[] = [];
  const activeConditions = conditions.filter((c) => c.status === 'active');
  const latestCheck = healthChecks[0] ?? null;

  if (vitals.heartRate !== null) {
    if (vitals.heartRate >= 120) {
      insights.push({
        id: 'hr-tachy',
        severity: 'critical',
        category: 'Cardiovascular',
        title: `Taquicardia (${vitals.heartRate} Lpm)`,
        reasoning: 'Frecuencia >120 Lpm en reposo.',
        suggestedAction: 'Hidratación y nueva toma en 10 min.',
        evidenceSources: ['NASA HRP Cardiovascular'],
      });
    } else if (vitals.heartRate > 0 && vitals.heartRate <= 45) {
      insights.push({
        id: 'hr-brady',
        severity: 'critical',
        category: 'Cardiovascular',
        title: `Bradicardia (${vitals.heartRate} Lpm)`,
        reasoning: 'Lectura <45 Lpm; verificar sensor.',
        suggestedAction: 'Confirmar ajuste y descartar mareo.',
        evidenceSources: ['NASA Autonomic Guidelines'],
      });
    }
  }

  if (vitals.spo2 !== null && vitals.spo2 > 0 && vitals.spo2 < 92) {
    insights.push({
      id: 'spo2-low',
      severity: vitals.spo2 < 90 ? 'critical' : 'warning',
      category: 'Oxigenación',
      title: `SpO2 baja (${vitals.spo2}%)`,
      reasoning: 'Debajo de banda nominal 95–100%.',
      suggestedAction: 'Revisar cabina O2/CO2 y reposo.',
      evidenceSources: ['ISS Respiratory Standard'],
    });
  }

  if (vitals.stress !== null && vitals.stress >= 70) {
    insights.push({
      id: 'stress-high',
      severity: vitals.stress >= 85 ? 'critical' : 'warning',
      category: 'Conductual',
      title: `Estrés elevado (${vitals.stress}/100)`,
      reasoning: 'Tensión simpática elevada sostenida.',
      suggestedAction: 'Respiración guiada 10 min.',
      evidenceSources: ['NASA BHP Evidence'],
    });
  }

  if (vitals.sleepHours !== null && vitals.sleepHours < 6.5) {
    insights.push({
      id: 'sleep-deficit',
      severity: vitals.sleepHours < 5.5 ? 'critical' : 'warning',
      category: 'Sueño',
      title: `Déficit de sueño (${vitals.sleepHours.toFixed(1)} h)`,
      reasoning: 'Menor a 7 h recomendadas en 0g.',
      suggestedAction: 'Bloque de descanso antes de ARED.',
      evidenceSources: ['NASA Circadian Guidelines'],
    });
  }

  for (const cond of activeConditions) {
    const tier = getRiskTierFromIntensity(cond.painIntensity);
    const severity = tier === 'red' ? 'critical' : 'warning';
    const isLowerLimbSwelling =
      cond.swelling && (cond.muscleId.startsWith('gemelo') || cond.muscleId.startsWith('muslo'));

    insights.push({
      id: `cond-${cond.muscleId}`,
      severity,
      category: cond.bodyRegion,
      title: `${cond.muscleName} (${cond.painIntensity}/10)`,
      reasoning: isLowerLimbSwelling
        ? 'Dolor e inflamación distal: vigilar estasis venoso.'
        : cond.description || cond.conditionName,
      suggestedAction:
        tier === 'red'
          ? 'Rojo: suspender carga y foto clínica.'
          : 'Amarillo/Naranja: reducir carga y vigilar.',
      evidenceSources: ['NASA Musculoskeletal Protocol'],
      relatedMuscleId: cond.muscleId,
    });
  }

  if (latestCheck && latestCheck.overallStatus !== 'normal') {
    insights.push({
      id: `hc-${latestCheck.dateIso}`,
      severity: latestCheck.overallStatus === 'critical' ? 'critical' : 'warning',
      category: `Check-in ${latestCheck.dateIso}`,
      title: `Check-in diario en ${latestCheck.overallStatus.toUpperCase()}`,
      reasoning: `Síntomas: ${latestCheck.symptoms.join(', ') || 'ninguno'}.`,
      suggestedAction: latestCheck.recommendation,
      evidenceSources: ['Flight Surgeon Check-In'],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'rag-baseline',
      severity: 'info',
      category: 'Estado Basal',
      title: 'Sin anomalías activas',
      reasoning: 'Indicadores dentro de rango nominal.',
      suggestedAction: 'Toca cualquier músculo 3D para inspeccionar.',
      evidenceSources: ['NASA HRP Baseline'],
    });
  }

  return insights;
}
