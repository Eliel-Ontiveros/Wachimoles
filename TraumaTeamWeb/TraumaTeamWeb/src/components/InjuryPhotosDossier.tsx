import React, { useEffect, useState } from 'react';
import type { ConnectionEndpointStatus, InjuryPhoto } from '../types/dashboard';
import {
  CameraIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from './Icons';

interface InjuryPhotosDossierProps {
  photos: InjuryPhoto[];
  status: ConnectionEndpointStatus['photosStatus'];
  error: string | null;
  onReload: () => void;
}

function formatPhotoDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const InjuryPhotosDossier: React.FC<InjuryPhotosDossierProps> = ({
  photos,
  status,
  error,
  onReload,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const filteredPhotos = photos;

  const safeIndex =
    filteredPhotos.length > 0 ? Math.min(activeIndex, filteredPhotos.length - 1) : 0;
  const activePhoto = filteredPhotos[safeIndex] ?? null;

  useEffect(() => {
    if (!isPlaying || filteredPhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % filteredPhotos.length);
    }, 1650);
    return () => window.clearInterval(timer);
  }, [isPlaying, filteredPhotos.length]);

  return (
    <div className="dossier-wrapper">
      <div className="dossier-toolbar">
        <span>{status === 'loading' ? 'Loading zone photos…' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} for this zone`}</span>
        <button type="button" className="dossier-pill" onClick={() => {
          setFailedUri(null);
          setIsPlaying(false);
          onReload();
        }} disabled={status === 'loading'}>
          Reload photos
        </button>
      </div>
      {status === 'loading' ? (
        <div className="dossier-empty-compact" role="status">Loading photos…</div>
      ) : status === 'error' || status === 'unauthorized' ? (
        <div className="dossier-empty-compact" role="alert">{error || 'Photos could not be loaded. Use Reload photos to try again.'}</div>
      ) : activePhoto ? (
        <div className="timelapse-stage">
          <div className="timelapse-media-box">
            {failedUri === activePhoto.uri ? (
              <div className="dossier-empty-compact" role="alert">
                This photo could not be displayed. Use Reload photos to renew its link.
              </div>
            ) : (
              <img
                src={activePhoto.uri}
                alt={`Reported discomfort in ${activePhoto.muscleName}, photo ${safeIndex + 1}`}
                className="timelapse-photo"
                onError={() => setFailedUri(activePhoto.uri)}
              />
            )}
            <span className="timelapse-day-badge">
              Photo {safeIndex + 1}/{filteredPhotos.length}
            </span>
          </div>

          <div className="timelapse-info-bar">
            <div className="timelapse-meta-col">
              <strong>{activePhoto.muscleName}</strong>
              <span className="timelapse-date">{activePhoto.capturedAt ? formatPhotoDateTime(activePhoto.capturedAt) : 'Capture date not recorded'}</span>
            </div>
            <div className="timelapse-controls">
              <button
                type="button"
                className="ctrl-icon-btn"
                onClick={() => setIsPlaying((p) => !p)}
                disabled={filteredPhotos.length <= 1}
                title={isPlaying ? 'Pause' : 'Play photo sequence'}
              >
                {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                <span>{isPlaying ? 'Pause' : 'Play sequence'}</span>
              </button>
              <button
                type="button"
                className="ctrl-icon-btn"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveIndex(0);
                }}
                title="First photo"
              >
                <RotateCcwIcon size={14} />
              </button>
            </div>
          </div>

          {activePhoto.note && <p className="timelapse-note">“{activePhoto.note}”</p>}

          <div className="timelapse-strip" role="list" aria-label="Photo thumbnails">
            {filteredPhotos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                className={`strip-thumb ${idx === safeIndex ? 'active' : ''}`}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveIndex(idx);
                }}
              >
                <img src={p.uri} alt={`Photo ${idx + 1} of ${p.muscleName}`} />
                <span>{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="dossier-empty-compact">
          <CameraIcon size={19} />
          <span>No photos have been uploaded for this zone.</span>
        </div>
      )}
    </div>
  );
};
