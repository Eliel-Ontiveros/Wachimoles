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
import { displaySymptom, getRegionCategoryLabel, isNoSymptom } from '../utils/display-labels.ts';

export const PRIMARY_ASTRONAUT: AstronautProfile = {
  id: 'eliel-alfonso',
  userId: import.meta.env.EXPO_PUBLIC_USER_ID || '',
  name: 'Eliel Alfonso',
  shortName: 'E. Alfonso',
  code: 'ASTRO-01',
  role: 'Astronaut · Active Subject',
  specialty: 'Mobile biomedical telemetry + smartwatch',
  origin: 'tierra',
  destination: 'luna',
  environment: 'nave',
  gravityLabel: '0g Microgravity',
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
        label: 'Mild Risk · Yellow',
        shortLabel: 'Yellow',
        color: '#ca8a04',
        bg: 'rgba(250, 204, 21, 0.16)',
        border: 'rgba(234, 179, 8, 0.55)',
      };
    case 'orange':
      return {
        label: 'Moderate Risk · Orange',
        shortLabel: 'Orange',
        color: '#ea580c',
        bg: 'rgba(249, 115, 22, 0.16)',
        border: 'rgba(249, 115, 22, 0.55)',
      };
    case 'red':
      return {
        label: 'Severe Risk · Red',
        shortLabel: 'Critical Red',
        color: '#dc2626',
        bg: 'rgba(239, 68, 68, 0.18)',
        border: 'rgba(239, 68, 68, 0.65)',
      };
    default:
      return {
        label: 'Nominal · No injury',
        shortLabel: 'Nominal',
        color: '#0284c7',
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.35)',
      };
  }
}

export function getPainSeverityLabel(intensity: number): string {
  if (intensity <= 0) return 'Nominal';
  if (intensity <= 3) return 'Mild (Yellow)';
  if (intensity <= 6) return 'Moderate (Orange)';
  if (intensity <= 8) return 'Severe (Red)';
  return 'Critical (Deep red)';
}

// Exact catalog of 3D anatomical zones synced with TraumaTeamMovil
export const INITIAL_MUSCLES: MuscleData[] = [
  // ==================== CABEZA Y CUELLO ====================
  {
    id: 'cara',
    name: 'Face / Facial region',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.785, 0.08],
    radii: [0.09, 0.09, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [0, 78, 1.45],
  },
  {
    id: 'cabeza',
    name: 'Head / Skull',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.83, -0.045],
    radii: [0.095, 0.105, 0.09],
    normal: [0, 0.35, -1],
    cameraAngles: [180, 70, 1.5],
  },
  {
    id: 'cuello',
    name: 'Neck',
    category: 'Cabeza y cuello',
    status: 'normal',
    center: [0.0, 0.665, 0.035],
    radii: [0.08, 0.065, 0.065],
    normal: [0, 0, 1],
    cameraAngles: [0, 80, 1.55],
  },
  {
    id: 'trapecio',
    name: 'Trapezius / Nape',
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
    name: 'Right pectoral',
    category: 'Tronco anterior',
    status: 'normal',
    center: [-0.085, 0.4, 0.085],
    radii: [0.09, 0.095, 0.075],
    normal: [0, 0, 1],
    cameraAngles: [-12, 78, 1.85],
  },
  {
    id: 'pectoral_izq',
    name: 'Left pectoral',
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
    name: 'Right oblique',
    category: 'Tronco anterior',
    status: 'normal',
    center: [-0.125, 0.14, 0.015],
    radii: [0.065, 0.115, 0.08],
    normal: [-0.85, 0, 0.5],
    cameraAngles: [-55, 82, 1.9],
  },
  {
    id: 'oblicuo_izq',
    name: 'Left oblique',
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
    name: 'Right latissimus',
    category: 'Tronco posterior',
    status: 'normal',
    center: [-0.095, 0.36, -0.115],
    radii: [0.095, 0.125, 0.08],
    normal: [0, 0, -1],
    cameraAngles: [195, 78, 1.9],
  },
  {
    id: 'dorsal_izq',
    name: 'Left latissimus',
    category: 'Tronco posterior',
    status: 'normal',
    center: [0.095, 0.36, -0.115],
    radii: [0.095, 0.125, 0.08],
    normal: [0, 0, -1],
    cameraAngles: [165, 78, 1.9],
  },
  {
    id: 'lumbar',
    name: 'Lower back',
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
    name: 'Right deltoid',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.225, 0.46, -0.03],
    radii: [0.08, 0.085, 0.085],
    normal: [-1, 0.2, 0],
    cameraAngles: [-75, 76, 1.85],
  },
  {
    id: 'deltoides_izq',
    name: 'Left deltoid',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.225, 0.46, -0.03],
    radii: [0.08, 0.085, 0.085],
    normal: [1, 0.2, 0],
    cameraAngles: [75, 76, 1.85],
  },
  {
    id: 'biceps_der',
    name: 'Right biceps',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.3, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, 0.8],
    cameraAngles: [-35, 80, 1.85],
  },
  {
    id: 'biceps_izq',
    name: 'Left biceps',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.3, 0.29, 0.015],
    radii: [0.075, 0.09, 0.055],
    normal: [0.6, 0, 0.8],
    cameraAngles: [35, 80, 1.85],
  },
  {
    id: 'triceps_der',
    name: 'Right triceps',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.29, 0.3, -0.06],
    radii: [0.075, 0.09, 0.055],
    normal: [-0.6, 0, -0.8],
    cameraAngles: [-145, 80, 1.85],
  },
  {
    id: 'triceps_izq',
    name: 'Left triceps',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.29, 0.3, -0.06],
    radii: [0.075, 0.09, 0.055],
    normal: [0.6, 0, -0.8],
    cameraAngles: [145, 80, 1.85],
  },
  {
    id: 'antebrazo_der',
    name: 'Right forearm',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.365, 0.155, -0.005],
    radii: [0.08, 0.095, 0.08],
    normal: [-0.8, 0, 0.6],
    cameraAngles: [-50, 82, 1.85],
  },
  {
    id: 'antebrazo_izq',
    name: 'Left forearm',
    category: 'Extremidad superior',
    status: 'normal',
    center: [0.365, 0.155, -0.005],
    radii: [0.08, 0.095, 0.08],
    normal: [0.8, 0, 0.6],
    cameraAngles: [50, 82, 1.85],
  },
  {
    id: 'mano_der',
    name: 'Right hand',
    category: 'Extremidad superior',
    status: 'normal',
    center: [-0.44, 0.015, 0.065],
    radii: [0.075, 0.085, 0.085],
    normal: [-0.7, 0, 0.7],
    cameraAngles: [-45, 84, 1.75],
  },
  {
    id: 'mano_izq',
    name: 'Left hand',
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
    name: 'Right glute',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [-0.09, -0.04, -0.105],
    radii: [0.09, 0.095, 0.085],
    normal: [0, 0, -1],
    cameraAngles: [195, 85, 1.9],
  },
  {
    id: 'gluteo_izq',
    name: 'Left glute',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [0.09, -0.04, -0.105],
    radii: [0.09, 0.095, 0.085],
    normal: [0, 0, -1],
    cameraAngles: [165, 85, 1.9],
  },
  {
    id: 'abductor_der',
    name: 'Abductor / Right hip',
    category: 'Cadera y pelvis',
    status: 'normal',
    center: [-0.165, -0.08, -0.01],
    radii: [0.06, 0.105, 0.09],
    normal: [-1, 0, 0],
    cameraAngles: [-85, 85, 1.9],
  },
  {
    id: 'abductor_izq',
    name: 'Abductor / Left hip',
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
    name: 'Right thigh (Quadriceps)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.11, -0.25, 0.045],
    radii: [0.095, 0.17, 0.07],
    normal: [0, 0, 1],
    cameraAngles: [-12, 84, 1.95],
  },
  {
    id: 'muslo_izq',
    name: 'Left thigh (Quadriceps)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.11, -0.25, 0.045],
    radii: [0.095, 0.17, 0.07],
    normal: [0, 0, 1],
    cameraAngles: [12, 84, 1.95],
  },
  {
    id: 'isquio_der',
    name: 'Right hamstrings (Back of leg)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.115, -0.28, -0.065],
    radii: [0.095, 0.165, 0.07],
    normal: [0, 0, -1],
    cameraAngles: [195, 86, 1.95],
  },
  {
    id: 'isquio_izq',
    name: 'Left hamstrings (Back of leg)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.115, -0.28, -0.065],
    radii: [0.095, 0.165, 0.07],
    normal: [0, 0, -1],
    cameraAngles: [165, 86, 1.95],
  },
  {
    id: 'gemelo_der',
    name: 'Right calf (Gastrocnemius)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.155, -0.63, -0.06],
    radii: [0.075, 0.145, 0.065],
    normal: [0, 0, -1],
    cameraAngles: [195, 88, 1.85],
  },
  {
    id: 'gemelo_izq',
    name: 'Left calf (Gastrocnemius)',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.155, -0.63, -0.06],
    radii: [0.075, 0.145, 0.065],
    normal: [0, 0, -1],
    cameraAngles: [165, 88, 1.85],
  },
  {
    id: 'espinilla_der',
    name: 'Right shin / Tibialis',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.155, -0.62, 0.01],
    radii: [0.07, 0.14, 0.055],
    normal: [0, 0, 1],
    cameraAngles: [-12, 88, 1.85],
  },
  {
    id: 'espinilla_izq',
    name: 'Left shin / Tibialis',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [0.155, -0.62, 0.01],
    radii: [0.07, 0.14, 0.055],
    normal: [0, 0, 1],
    cameraAngles: [12, 88, 1.85],
  },
  {
    id: 'pie_der',
    name: 'Right foot',
    category: 'Extremidad inferior',
    status: 'normal',
    center: [-0.175, -0.9, 0.025],
    radii: [0.08, 0.075, 0.14],
    normal: [0, 0.35, 1],
    cameraAngles: [-15, 82, 1.65],
  },
  {
    id: 'pie_izq',
    name: 'Left foot',
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
    anatomicalSummary: 'Cervical musculature, skull base and facial region.',
    biomechanicalRole: 'Supports the head and absorbs EVA helmet load.',
    spaceflightImpact: 'Cephalad fluid shift in 0g and neck strain from the helmet.',
    keyStructures: ['Sternocleidomastoid', 'Suboccipitals', 'C1–C7'],
    preventiveCountermeasure: 'Gentle cervical isometrics and constant hydration.',
    yellowProtocol: 'Gentle neck mobility and monitor blood pressure.',
    redProtocol: 'Rule out trauma or SANS; limit EVA activity.',
    ragReferences: [
      {
        title: 'SANS & Fluid Shifts',
        source: 'NASA HRP',
        focus: 'Edema and cephalad pressure in 0g',
      },
      {
        title: 'Cervical Spine Adaptation',
        source: 'Aerospace Med',
        focus: 'Cervical overload',
      },
    ],
  },
  'Tronco anterior': {
    anatomicalSummary: 'Anterior chest wall and stabilizing abdominal girdle.',
    biomechanicalRole: 'Stabilizes the thorax and coordinates push/pull in 0g.',
    spaceflightImpact: 'Loss of postural tone and overload during translation.',
    keyStructures: ['Pectoralis major', 'Rectus abdominis', 'Obliques'],
    preventiveCountermeasure: 'Progressive core activation without hyperpressure.',
    yellowProtocol: 'Reduce upper-body load for 24–48 h.',
    redProtocol: 'Rule out cardiopulmonary origin with ECG and SpO2.',
    ragReferences: [
      {
        title: 'Core Stabilization in 0g',
        source: 'J. Appl. Physiol.',
        focus: 'Abdominal atrophy in orbit',
      },
      {
        title: 'Thoracic Triage Protocol',
        source: 'NASA Medical',
        focus: 'Chest pain vs cardiac pain',
      },
    ],
  },
  'Tronco posterior': {
    anatomicalSummary: 'Deep posterior chain, spinal erectors and lumbar area.',
    biomechanicalRole: 'Stabilizes the thoracolumbar spine and transfers force.',
    spaceflightImpact: 'Disc expansion in 0g (+2–5 cm) and frequent low back pain.',
    keyStructures: ['Latissimus dorsi', 'Multifidus', 'L1–S1 discs'],
    preventiveCountermeasure: 'Gentle lumbar flexion and ARED axial load control.',
    yellowProtocol: 'Lumbar offloading, moderate heat and pause ARED.',
    redProtocol: 'Suspected radicular pain: suspend ARED/EVA and monitor.',
    ragReferences: [
      {
        title: 'Spaceflight Disc Swelling',
        source: 'NASA HRP',
        focus: 'Spinal elongation and low back pain',
      },
      {
        title: 'Lumbar Multifidus Study',
        source: 'Eur Spine J',
        focus: 'Post-flight lumbar protection',
      },
    ],
  },
  'Extremidad superior': {
    anatomicalSummary: 'Shoulder, arm, forearm and grip musculature.',
    biomechanicalRole: 'Main driver of translation and holding in microgravity.',
    spaceflightImpact: 'Rotator cuff fatigue and EVA glove trauma.',
    keyStructures: ['Deltoid', 'Biceps / Triceps', 'Carpal tendons'],
    preventiveCountermeasure: 'Alternate handrail grip and stretch forearms.',
    yellowProtocol: 'Relative rest and a daily photo if there is a skin injury.',
    redProtocol: 'Partial immobilization; suspend EVA grip tasks.',
    ragReferences: [
      {
        title: 'EVA Glove Trauma Surveillance',
        source: 'NASA EVA Lab',
        focus: 'Grip fatigue and EVA injuries',
      },
      {
        title: 'Rotator Cuff in Microgravity',
        source: 'Aerospace Med',
        focus: 'Manual overload in 0g',
      },
    ],
  },
  'Cadera y pelvis': {
    anatomicalSummary: 'Stabilizing glutes, abductors and the hip joint.',
    biomechanicalRole: 'Lateral pelvic stability and hip extension.',
    spaceflightImpact: 'Bone loss at the femoral neck and atrophy without ARED.',
    keyStructures: ['Gluteus maximus/medius', 'Iliotibial band', 'Femoral neck'],
    preventiveCountermeasure: 'ARED-assisted squat and lateral stretching.',
    yellowProtocol: 'Lower resistance by 40% and watch for radiating pain.',
    redProtocol: 'Suspend ARED/T2 axial load and evaluate tendon/sciatic nerve.',
    ragReferences: [
      {
        title: 'Femoral Neck & Gluteus Countermeasures',
        source: 'NASA Muscle Lab',
        focus: 'Pelvic load in orbit',
      },
    ],
  },
  'Extremidad inferior': {
    anatomicalSummary: 'Quadriceps, hamstrings, calves, soleus and foot.',
    biomechanicalRole: 'Anti-gravity support, T2 running and venous return.',
    spaceflightImpact: 'Accelerated atrophy (soleus/calves) and venous stasis in 0g.',
    keyStructures: ['Quadriceps', 'Calves and soleus', 'Achilles tendon'],
    preventiveCountermeasure: 'T2 treadmill with harness and daily skin check.',
    yellowProtocol: 'Slow the T2 treadmill pace and monitor edema.',
    redProtocol: 'Suspend T2; if there is unilateral swelling, rule out DVT.',
    ragReferences: [
      {
        title: 'Calf Atrophy in Orbit',
        source: 'NASA HRP',
        focus: 'Calf deconditioning',
      },
      {
        title: 'Spaceflight Venous Thrombosis',
        source: 'NEJM / NASA',
        focus: 'Lower-limb vascular surveillance',
      },
    ],
  },
};

const SPECIFIC_MUSCLE_OVERRIDES: Record<string, Partial<MuscleMedicalKnowledge>> = {
  cara: {
    anatomicalSummary: 'Facial region, paranasal sinuses and facial-expression muscles.',
    spaceflightImpact: 'Fluid congestion in 0g and mask chafing.',
  },
  cabeza: {
    anatomicalSummary: 'Skull, scalp and temporo-occipital region.',
    spaceflightImpact: 'Bumps against bulkheads and headaches from CO2 / fluids.',
  },
  cuello: {
    anatomicalSummary: 'Anterior/lateral cervical spine and sternocleidomastoid.',
    spaceflightImpact: 'Strain from the EVA helmet ring and turning in 0g.',
  },
  trapecio: {
    anatomicalSummary: 'Upper/middle trapezius and suboccipital nape area.',
    spaceflightImpact: 'Postural strain at consoles without support.',
  },
  lumbar: {
    anatomicalSummary: 'Lumbar paravertebrals, multifidus and L1–L5 segments.',
    spaceflightImpact: '#1 pain zone in orbit due to 0g disc expansion.',
  },
  gemelo_der: {
    anatomicalSummary: 'Right gastrocnemius, soleus and Achilles tendon.',
    spaceflightImpact: 'High atrophy in 0g; key focus of vascular surveillance.',
  },
  gemelo_izq: {
    anatomicalSummary: 'Left gastrocnemius, soleus and Achilles tendon.',
    spaceflightImpact: 'High atrophy in 0g; key focus of vascular surveillance.',
  },
  mano_der: {
    anatomicalSummary: 'Palmar musculature, flexor tendons and skin of the right hand.',
    spaceflightImpact: 'Grip fatigue and chafing from the pressurized glove.',
  },
  mano_izq: {
    anatomicalSummary: 'Palmar musculature, flexor tendons and skin of the left hand.',
    spaceflightImpact: 'Grip fatigue and chafing from the pressurized glove.',
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
      differentialWarnings.push(`Severe pain (${intensity}/10): restrict load.`);
      recommendedActions.push(knowledge.redProtocol);
    } else if (riskTier === 'orange') {
      differentialWarnings.push(`Moderate pain (${intensity}/10): possible overload.`);
      recommendedActions.push(knowledge.yellowProtocol);
    } else {
      differentialWarnings.push(`Mild discomfort (${intensity}/10): early stage.`);
      recommendedActions.push(knowledge.yellowProtocol);
    }

    if (obs.swelling) {
      differentialWarnings.push('Edema reported: monitor progress.');
      if (muscle.id.startsWith('gemelo') || muscle.id.startsWith('muslo')) {
        differentialWarnings.push('Vascular alert: rule out stasis or DVT.');
      }
      recommendedActions.push('Capture a daily photo to measure progress.');
    }

    if (obs.functionalLimitation) {
      differentialWarnings.push('Functional limitation: pause ARED / T2.');
    }
  }

  if (vitals.heartRate !== null) {
    if (vitals.heartRate >= 105) {
      telemetryCorrelations.push(`Elevated pulse (${vitals.heartRate} BPM).`);
    } else {
      telemetryCorrelations.push(`Baseline pulse (${vitals.heartRate} BPM).`);
    }
  }

  if (vitals.stress !== null) {
    if (vitals.stress >= 70) {
      telemetryCorrelations.push(`High stress (${vitals.stress}/100).`);
      recommendedActions.push('Apply guided breathing for 10 min.');
    } else {
      telemetryCorrelations.push(`Stress at ${vitals.stress}/100.`);
    }
  }

  if (vitals.spo2 !== null && vitals.spo2 < 94) {
    telemetryCorrelations.push(`Borderline SpO2 (${vitals.spo2}%).`);
  }

  if (vitals.sleepHours !== null && vitals.sleepHours < 6.5) {
    telemetryCorrelations.push(`Low sleep (${vitals.sleepHours.toFixed(1)} h).`);
  }

  if (latestCheck) {
    if (latestCheck.temperatureC !== null && latestCheck.temperatureC >= 37.5) {
      telemetryCorrelations.push(`Temp. ${latestCheck.temperatureC}°C at check-in.`);
    }
    if (latestCheck.symptoms.length > 0 && !latestCheck.symptoms.every(isNoSymptom)) {
      telemetryCorrelations.push(`Symptoms: ${latestCheck.symptoms.map(displaySymptom).join(', ')}.`);
    }
  }

  let clinicalSummary = `${muscle.name}: nominal status, no active alerts.`;
  if (obs && intensity > 0) {
    clinicalSummary = `${muscle.name} · Risk: ${getPainSeverityLabel(intensity)} (${intensity}/10)${
      obs.swelling ? ' · With swelling' : ''
    }${obs.functionalLimitation ? ' · Limitation' : ''}.`;
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
        title: `Tachycardia (${vitals.heartRate} BPM)`,
        reasoning: 'Rate >120 BPM at rest.',
        suggestedAction: 'Hydrate and re-measure in 10 min.',
        evidenceSources: ['NASA HRP Cardiovascular'],
      });
    } else if (vitals.heartRate > 0 && vitals.heartRate <= 45) {
      insights.push({
        id: 'hr-brady',
        severity: 'critical',
        category: 'Cardiovascular',
        title: `Bradycardia (${vitals.heartRate} BPM)`,
        reasoning: 'Reading <45 BPM; check the sensor.',
        suggestedAction: 'Confirm fit and rule out dizziness.',
        evidenceSources: ['NASA Autonomic Guidelines'],
      });
    }
  }

  if (vitals.spo2 !== null && vitals.spo2 > 0 && vitals.spo2 < 92) {
    insights.push({
      id: 'spo2-low',
      severity: vitals.spo2 < 90 ? 'critical' : 'warning',
      category: 'Oxygenation',
      title: `Low SpO2 (${vitals.spo2}%)`,
      reasoning: 'Below the nominal 95–100% band.',
      suggestedAction: 'Check cabin O2/CO2 and rest.',
      evidenceSources: ['ISS Respiratory Standard'],
    });
  }

  if (vitals.stress !== null && vitals.stress >= 70) {
    insights.push({
      id: 'stress-high',
      severity: vitals.stress >= 85 ? 'critical' : 'warning',
      category: 'Behavioral',
      title: `Elevated stress (${vitals.stress}/100)`,
      reasoning: 'Sustained elevated sympathetic tension.',
      suggestedAction: 'Guided breathing for 10 min.',
      evidenceSources: ['NASA BHP Evidence'],
    });
  }

  if (vitals.sleepHours !== null && vitals.sleepHours < 6.5) {
    insights.push({
      id: 'sleep-deficit',
      severity: vitals.sleepHours < 5.5 ? 'critical' : 'warning',
      category: 'Sleep',
      title: `Sleep deficit (${vitals.sleepHours.toFixed(1)} h)`,
      reasoning: 'Below the 7 h recommended in 0g.',
      suggestedAction: 'Rest block before ARED.',
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
      category: getRegionCategoryLabel(cond.bodyRegion),
      title: `${cond.muscleName} (${cond.painIntensity}/10)`,
      reasoning: isLowerLimbSwelling
        ? 'Distal pain and inflammation: monitor venous stasis.'
        : cond.description || cond.conditionName,
      suggestedAction:
        tier === 'red'
          ? 'Red: suspend load and take a clinical photo.'
          : 'Yellow/Orange: reduce load and monitor.',
      evidenceSources: ['NASA Musculoskeletal Protocol'],
      relatedMuscleId: cond.muscleId,
    });
  }

  if (latestCheck && latestCheck.overallStatus !== 'normal') {
    insights.push({
      id: `hc-${latestCheck.dateIso}`,
      severity: latestCheck.overallStatus === 'critical' ? 'critical' : 'warning',
      category: `Check-in ${latestCheck.dateIso}`,
      title: `Daily check-in ${latestCheck.overallStatus.toUpperCase()}`,
      reasoning: `Symptoms: ${latestCheck.symptoms.map(displaySymptom).join(', ') || 'none'}.`,
      suggestedAction: latestCheck.recommendation,
      evidenceSources: ['Flight Surgeon Check-In'],
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'rag-baseline',
      severity: 'info',
      category: 'Baseline',
      title: 'No active anomalies',
      reasoning: 'Indicators within nominal range.',
      suggestedAction: 'Tap any 3D muscle to inspect it.',
      evidenceSources: ['NASA HRP Baseline'],
    });
  }

  return insights;
}
