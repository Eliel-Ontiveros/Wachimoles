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
  // Keep all structured symptoms and their timestamp within the existing API limit.
  // Free text stays verbatim; it is reported data, never an established diagnosis.
  const question = [
    'Explain only what the indexed documents support about these reported muscle symptoms. State when evidence is insufficient to explain their cause. Do not infer a diagnosis.',
    `Reported condition (not confirmed): ${observation.conditionName.slice(0, 180)}.`,
    `Pain intensity: ${observation.painIntensity}/10.`,
    `Swelling: ${observation.swelling ? 'reported' : 'not reported'}.`,
    `Functional limitation: ${observation.functionalLimitation ? 'reported' : 'not reported'}.`,
    `Reported at: ${observation.recordedAtIso?.slice(0, 40) || 'unknown'}.`,
    `Reported notes: ${observation.notes.slice(0, 700) || 'none'}`,
  ].join('\n');
  return { question, environment, bodyZone: muscle.name.slice(0, 100) };
}
