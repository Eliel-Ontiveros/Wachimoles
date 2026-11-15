import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronRightIcon } from './Icons';
import './side-carousel.css';

export interface SideCarouselSlide {
  id: string;
  label: string;
  content: ReactNode;
}

interface SideCarouselProps {
  enabled: boolean;
  slides: SideCarouselSlide[];
  ariaLabel?: string;
}

/**
 * Horizontal slide carousel. While disabled it renders only the first slide,
 * in the same tree position, so its content stays mounted when toggled.
 */
export function SideCarousel({ enabled, slides, ariaLabel = 'Dashboard sections' }: SideCarouselProps) {
  const [index, setIndex] = useState(0);

  // Reset to the first slide whenever the carousel is disabled (adjust state during render).
  if (!enabled && index !== 0) setIndex(0);

  const count = slides.length;
  const current = enabled ? Math.min(index, count - 1) : 0;
  const go = (target: number) => setIndex(((target % count) + count) % count);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!enabled || count < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(current - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(current + 1);
    }
  };

  const visibleSlides = enabled ? slides : slides.slice(0, 1);
  const prev = slides[(current - 1 + count) % count];
  const next = slides[(current + 1) % count];

  return (
    <section
      className={`side-carousel ${enabled ? 'is-enabled' : ''}`}
      role={enabled ? 'region' : undefined}
      aria-roledescription={enabled ? 'carousel' : undefined}
      aria-label={enabled ? ariaLabel : undefined}
      onKeyDown={handleKeyDown}
    >
      {enabled && count > 1 && (
        <header className="side-carousel-header">
          <button
            type="button"
            className="side-carousel-arrow side-carousel-arrow-prev"
            onClick={() => go(current - 1)}
            aria-label={`Previous: ${prev.label}`}
          >
            <ChevronRightIcon size={16} />
          </button>
          <div className="side-carousel-title-wrap">
            <h2 className="side-carousel-title">{slides[current].label}</h2>
            <div className="side-carousel-dots">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  className={`side-carousel-dot ${i === current ? 'active' : ''}`}
                  aria-label={slide.label}
                  aria-current={i === current ? 'true' : undefined}
                  onClick={() => go(i)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="side-carousel-arrow"
            onClick={() => go(current + 1)}
            aria-label={`Next: ${next.label}`}
          >
            <ChevronRightIcon size={16} />
          </button>
        </header>
      )}

      <div className="side-carousel-viewport">
        <div
          className="side-carousel-track"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {visibleSlides.map((slide, i) => {
            const active = i === current;
            return (
              <div
                key={slide.id}
                className={`side-carousel-slide ${active ? 'active' : ''}`}
                inert={!active}
                aria-hidden={!active}
              >
                {slide.content}
              </div>
            );
          })}
        </div>
      </div>

      {enabled && (
        <p className="side-carousel-live" aria-live="polite" role="status">
          {`Slide ${current + 1} of ${count}: ${slides[current].label}`}
        </p>
      )}
    </section>
  );
}
