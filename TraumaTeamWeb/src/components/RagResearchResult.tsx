import { useId } from 'react';
import type { AssistantAnswer, AssistantMode } from '../services/assistant-api';
import { BookOpenIcon, ChevronRightIcon } from './Icons';

const RESULT_TITLES: Record<AssistantMode, string> = {
  generated: 'What the research says',
  evidence_only: 'Sources found · summary not enabled',
  insufficient_evidence: 'Not enough evidence',
  generation_unavailable: 'Summary unavailable',
};

export function RagResearchResult({ answer }: { answer: AssistantAnswer }) {
  const prefix = useId();
  const paragraphs = answer.answer.split(/\n\s*\n/).filter((text) => text.trim());
  const [takeaway, ...additional] = paragraphs;

  function renderText(text: string) {
    return text.split(/(\[\d+\])/g).map((part, index) => {
      const id = /^\[(\d+)\]$/.exec(part)?.[1];
      if (!id || !answer.citations.some((source) => source.citationId === Number(id))) return part;
      return <a key={index} className="research-citation" href={`#${prefix}-${id}`} aria-label={`Read source ${id}`} onClick={(event) => {
        const source = document.getElementById(`${prefix}-${id}`);
        if (!(source instanceof HTMLDetailsElement)) return;
        event.preventDefault();
        // Reveal both disclosure levels before navigating to the cited passage.
        let ancestor: HTMLElement | null = source;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        source.querySelector('summary')?.focus({ preventScroll: true });
        source.scrollIntoView({ block: 'nearest' });
      }}>{part}</a>;
    });
  }

  return (
    <div className={`research-result research-result--${answer.mode}`}>
      <div className="research-takeaway">
        <h4>{RESULT_TITLES[answer.mode]}</h4>
        <p>{renderText(takeaway)}</p>
      </div>

      {additional.length > 0 && (
        <details className="research-disclosure">
          <summary>
            <span>Read the full explanation <span className="research-count">({additional.length} more {additional.length === 1 ? 'finding' : 'findings'})</span></span>
            <ChevronRightIcon size={18} />
          </summary>
          <div className="research-explanation">
            {additional.map((paragraph, index) => <p key={index}>{renderText(paragraph)}</p>)}
          </div>
        </details>
      )}

      {answer.citations.length > 0 && (
        <details className="research-disclosure research-sources" open={answer.mode !== 'generated'}>
          <summary>
            <span className="research-source-label"><BookOpenIcon size={18} /> Explore {answer.citations.length} {answer.citations.length === 1 ? 'source' : 'sources'}</span>
            <ChevronRightIcon size={18} />
          </summary>
          <div className="research-source-list">
            {answer.citations.map((citation) => (
              <details className="research-source" key={citation.chunkId} id={`${prefix}-${citation.citationId}`}>
                <summary>
                  <span className="research-source-number">[{citation.citationId}]</span>
                  <span><span className="research-source-title">{citation.title}</span><span className="research-publisher">{citation.publisher}</span></span>
                  <ChevronRightIcon size={16} />
                </summary>
                <blockquote>{citation.excerpt}</blockquote>
                <a className="research-original" href={citation.url} target="_blank" rel="noopener noreferrer">Read original source <span className="research-new-tab">(opens in new tab)</span></a>
                <p className="research-source-meta">Retrieved {citation.retrievedAt.slice(0, 10)} · Passage: {citation.chunkId}</p>
              </details>
            ))}
          </div>
        </details>
      )}

      <aside className="research-safety" aria-label="Limits and safety">
        <strong>Research, not a diagnosis</strong>
        <p>For urgent symptoms, follow mission emergency procedures and contact the crew medical officer.</p>
        <details>
          <summary>About this assessment</summary>
          <p>{answer.notice}</p>
        </details>
      </aside>
    </div>
  );
}
