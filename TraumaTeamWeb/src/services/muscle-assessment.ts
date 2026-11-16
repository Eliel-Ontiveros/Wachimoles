import type { EnvironmentType, MuscleData } from '../types/dashboard';
import type { AssistantEnvironment, AssistantQuestion } from './assistant-api';

const ENVIRONMENTS: Record<EnvironmentType, AssistantEnvironment> = {
  tierra: 'earth',
  nave: 'spacecraft',
  estacion: 'spacecraft',
  luna: 'moon',
  marte: 'mars',
};

export function toAssistantEnvironment(environment: EnvironmentType): AssistantEnvironment {
  return ENVIRONMENTS[environment];
}

export function buildMuscleAssessmentQuestion(
  muscle: MuscleData,
  environment: AssistantEnvironment,
): AssistantQuestion | null {
  const observation = muscle.observation;
  if (muscle.status === 'normal' || !observation) return null;
  // Keep reported facts separate from instructions and lexical search terms.
  return {
    question: 'What can the indexed research explain about this reported muscle problem?',
    environment,
    bodyZone: muscle.name.slice(0, 100),
    muscleReport: {
      conditionName: observation.conditionName.slice(0, 180),
      painIntensity: observation.painIntensity,
      swelling: observation.swelling,
      functionalLimitation: observation.functionalLimitation,
      notes: observation.notes.slice(0, 700),
      ...(observation.recordedAtIso ? { recordedAtIso: observation.recordedAtIso.slice(0, 40) } : {}),
    },
  };
}
