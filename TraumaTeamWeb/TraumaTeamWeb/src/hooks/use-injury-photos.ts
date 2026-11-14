import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, fetchInjuryPhotosFromBackend } from '../services/backend-api';
import type { ConnectionEndpointStatus, InjuryPhoto } from '../types/dashboard';

interface PhotoState {
  key: string;
  photos: InjuryPhoto[];
  status: ConnectionEndpointStatus['photosStatus'];
  error: string | null;
}

export function useInjuryPhotos(muscleId: string | null, muscleName: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<PhotoState>({ key: '', photos: [], status: 'idle', error: null });
  const key = JSON.stringify([muscleId, muscleName, revision]);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!muscleId || !muscleName) return;
    const muscle = { id: muscleId, name: muscleName };
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const photos = await fetchInjuryPhotosFromBackend(muscle, controller.signal);
        if (!controller.signal.aborted) setState({ key, photos, status: 'ok', error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({
          key, photos: [], status: error instanceof ApiRequestError && error.status === 401 ? 'unauthorized' : 'error',
          error: error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Photos took too long to load. Please try again.',
        });
      } finally { pending = false; }
    }
    void load();
    // Refresh short-lived URLs and discover new uploads for the selected zone only.
    const timer = window.setInterval(() => void load(), 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [key, muscleId, muscleName]);

  const current: Omit<PhotoState, 'key'> = !muscleId
    ? { photos: [], status: 'idle', error: null }
    : state.key === key ? state : { photos: [], status: 'loading', error: null };
  return { ...current, reload };
}
