import { useEffect, useRef, useState } from 'react';
import type { MuscleData } from '../types/dashboard';
import { askAssistant } from '../services/assistant-api';
import type { AssistantAnswer, AssistantEnvironment } from '../services/assistant-api';
import { buildMuscleAssessmentQuestion } from '../services/muscle-assessment';
import { RagResearchResult } from './RagResearchResult';
import './muscle-rag-assessment.css';

interface Props {
  muscle: MuscleData;
  initialEnvironment: AssistantEnvironment;
}

export function MuscleRagAssessment({ muscle, initialEnvironment }: Props) {
  const [environment, setEnvironment] = useState(initialEnvironment);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const request = buildMuscleAssessmentQuestion(muscle, environment);

  useEffect(() => () => pending.current?.abort(), []);

  async function assess() {
    if (!request || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await askAssistant(request, controller.signal);
      if (!controller.signal.aborted) setAnswer(result);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error && cause.name === 'TimeoutError'
          ? 'The assessment timed out. Please try again.'
          : cause instanceof Error ? cause.message : 'The assessment could not be loaded. Please try again.');
      }
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="ai-slot-card rag-assessment" aria-label="Document-based muscle assessment" aria-busy={loading}>
      <div className="ai-slot-head">
        <h3>Understand your symptoms</h3>
      </div>
      <div className="ai-slot-body rag-assessment-body">
        {answer && <RagResearchResult answer={answer} />}
        {!answer && request && !loading && <p className="research-intro">See what published research can explain about your symptoms, with sources you can explore.</p>}
        {!request && <p className="rag-empty">No active symptoms are recorded for this muscle. Select a muscle with an active report to request an assessment.</p>}
        {request && (
          <div className="rag-controls">
            <label className="rag-environment">
              Your environment
              <select value={environment} disabled={loading} onChange={(event) => {
                setEnvironment(event.target.value as AssistantEnvironment);
                setAnswer(null);
                setError(null);
              }}>
                <option value="earth">Earth</option>
                <option value="spacecraft">Spacecraft</option>
                <option value="moon">Moon</option>
                <option value="mars">Mars</option>
              </select>
            </label>
            <button type="button" className={`rag-assess-button${answer ? ' is-secondary' : ''}`} disabled={loading} onClick={() => void assess()}>
              {loading ? 'Analyzing your symptoms…' : error ? 'Retry assessment' : answer ? 'Review symptoms again' : 'Review your symptoms'}
            </button>
          </div>
        )}
        <div aria-live="polite" role="status">
          {loading && <div className="rag-loading"><span aria-hidden="true" /><p>Retrieving evidence and checking source references…</p></div>}
          {answer && <span className="research-sr-only">Research ready. {answer.citations.length} sources available.</span>}
        </div>
        {error && <p className="rag-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
