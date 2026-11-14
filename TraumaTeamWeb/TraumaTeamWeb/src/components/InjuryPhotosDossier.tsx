import React, { useEffect, useMemo, useState } from 'react';
import type { InjuryPhoto, MuscleData } from '../types/dashboard';
import {
  CameraIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
} from './Icons';

interface InjuryPhotosDossierProps {
  photos: InjuryPhoto[];
  muscles: MuscleData[];
  selectedMuscleId: string | null;
  onSelectMuscle: (muscleId: string) => void;
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
  muscles,
  selectedMuscleId,
  onSelectMuscle,
}) => {
  const hasSelectedPhotos = Boolean(
    selectedMuscleId && photos.some((p) => p.muscleId === selectedMuscleId)
  );
  const [filterMode, setFilterMode] = useState<'all' | 'selected'>(
    hasSelectedPhotos ? 'selected' : 'all'
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const filteredPhotos = useMemo(() => {
    const base =
      filterMode === 'selected' && selectedMuscleId
        ? photos.filter((p) => p.muscleId === selectedMuscleId)
        : photos;

    return base.slice().sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    });
  }, [photos, filterMode, selectedMuscleId]);

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

  const groupedZones = useMemo(() => {
    const map = new Map<string, { muscleId: string; muscleName: string; count: number }>();
    for (const p of photos) {
      const existing = map.get(p.muscleId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(p.muscleId, { muscleId: p.muscleId, muscleName: p.muscleName, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [photos]);

  const selectedMuscleObj = muscles.find((m) => m.id === selectedMuscleId) ?? null;
  const selectedPhotoCount = selectedMuscleObj
    ? photos.filter((p) => p.muscleId === selectedMuscleObj.id).length
    : 0;

  return (
    <div className="dossier-wrapper">
      <div className="dossier-toolbar">
        <div className="dossier-filter-pills">
          {selectedMuscleObj && (
            <button
              type="button"
              className={`dossier-pill ${filterMode === 'selected' ? 'active' : ''}`}
              onClick={() => {
                setFilterMode('selected');
                setActiveIndex(0);
                setIsPlaying(false);
              }}
            >
              Zona ({selectedPhotoCount})
            </button>
          )}
          <button
            type="button"
            className={`dossier-pill ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterMode('all');
              setActiveIndex(0);
              setIsPlaying(false);
            }}
          >
            Todas ({photos.length})
          </button>
        </div>
      </div>

      {groupedZones.length > 1 && (
        <div className="photo-zone-chips">
          {groupedZones.map((gz) => (
            <button
              key={gz.muscleId}
              type="button"
              className={`zone-chip-sm ${selectedMuscleId === gz.muscleId ? 'active' : ''}`}
              onClick={() => {
                onSelectMuscle(gz.muscleId);
                setFilterMode('selected');
                setActiveIndex(0);
              }}
            >
              {gz.muscleName} ({gz.count})
            </button>
          ))}
        </div>
      )}

      {activePhoto ? (
        <div className="timelapse-stage">
          <div className="timelapse-media-box">
            <img
              src={activePhoto.uri}
              alt={`Día ${activePhoto.dayNumber} en ${activePhoto.muscleName}`}
              className="timelapse-photo"
            />
            <span className="timelapse-day-badge">
              DÍA {activePhoto.dayNumber} · {safeIndex + 1}/{filteredPhotos.length}
            </span>
          </div>

          <div className="timelapse-info-bar">
            <div className="timelapse-meta-col">
              <strong>{activePhoto.muscleName}</strong>
              <span className="timelapse-date">{formatPhotoDateTime(activePhoto.capturedAt)}</span>
            </div>
            <div className="timelapse-controls">
              <button
                type="button"
                className="ctrl-icon-btn"
                onClick={() => setIsPlaying((p) => !p)}
                disabled={filteredPhotos.length <= 1}
                title={isPlaying ? 'Pausar' : 'Reproducir evolución'}
              >
                {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                <span>{isPlaying ? 'Pausar' : 'Evolución'}</span>
              </button>
              <button
                type="button"
                className="ctrl-icon-btn"
                onClick={() => {
                  setIsPlaying(false);
                  setActiveIndex(0);
                }}
                title="Día 1"
              >
                <RotateCcwIcon size={14} />
              </button>
            </div>
          </div>

          {activePhoto.note && <p className="timelapse-note">“{activePhoto.note}”</p>}

          <div className="timelapse-strip" role="list" aria-label="Miniaturas diarias">
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
                <img src={p.uri} alt={`Día ${p.dayNumber}`} />
                <span>D{p.dayNumber}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="dossier-empty-compact">
          <CameraIcon size={19} />
          <span>Sin fotos registradas desde móvil aún.</span>
        </div>
      )}
    </div>
  );
};
