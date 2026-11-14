import { useEffect, useId, useRef, useState } from 'react';
import type { MuscleData } from '../types/dashboard';
import { askAssistant } from '../services/assistant-api';
import type { AssistantAnswer, AssistantEnvironment, AssistantMode } from '../services/assistant-api';
import { buildMuscleAssessmentQuestion } from '../services/muscle-assessment';

const MODE_LABELS: Record<AssistantMode, string> = {
  generated: 'Document-based explanation',
  evidence_only: 'Retrieved passages · synthesis disabled',
  insufficient_evidence: 'Insufficient documentary evidence',
  generation_unavailable: 'Synthesis unavailable · passages only',
};

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
  const sourcePrefix = useId();
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
        <h3>Document-based assessment</h3>
      </div>
      <div className="ai-slot-body rag-assessment-body">
        {answer && (
          <div className="rag-result" aria-live="polite">
            <h3>{MODE_LABELS[answer.mode]}</h3>
            {answer.answer.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="rag-answer-text">
                {paragraph.split(/(\[\d+\])/g).map((part, partIndex) => {
                  const id = /^\[(\d+)\]$/.exec(part)?.[1];
                  return id && answer.citations.some((citation) => citation.citationId === Number(id))
                    ? <a key={partIndex} href={`#${sourcePrefix}-${id}`} aria-label={`Read source ${id}`} onClick={() => {
                      const source = document.getElementById(`${sourcePrefix}-${id}`);
                      if (source instanceof HTMLDetailsElement) source.open = true;
                    }}>{part}</a>
                    : part;
                })}
              </p>
            ))}
            {answer.citations.length > 0 && (
              <div className="rag-sources">
                <h4>Retrieved evidence ({answer.citations.length})</h4>
                {answer.citations.map((citation) => (
                  <details key={citation.chunkId} id={`${sourcePrefix}-${citation.citationId}`}>
                    <summary>[{citation.citationId}] {citation.title}</summary>
                    <blockquote>{citation.excerpt}</blockquote>
                    <a href={citation.url} target="_blank" rel="noopener noreferrer">Read original source · {citation.publisher}</a>
                    <p>Snapshot: {citation.retrievedAt.slice(0, 10)} · Passage: {citation.chunkId}</p>
                  </details>
                ))}
              </div>
            )}
            <p className="rag-notice">{answer.notice}</p>
          </div>
        )}
        {!request && <p className="rag-empty">No active symptoms are recorded for this muscle. Select a muscle with an active report to request an assessment.</p>}
        {request && (
          <div className="rag-controls">
            <label className="rag-environment">
              Selected environment
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
        </div>
        {error && <p className="rag-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
