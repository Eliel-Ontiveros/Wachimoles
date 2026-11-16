import { useCallback, useEffect, useState } from 'react';
import {
  ApiRequestError,
  fetchBodyProfileFromBackend,
  fetchLatestWeightFromBackend,
} from '../services/backend-api';
import type { BodyProfile, WeightRecord } from '../types/dashboard';

export type BodyCompositionStatus = 'loading' | 'ok' | 'unauthorized' | 'error';

export interface BodyCompositionState {
  status: BodyCompositionStatus;
  weighing: WeightRecord | null;
  profile: BodyProfile | null;
  error: string | null;
}

/** A new weighing shows up within a few seconds, like the alerts panel; paused while the tab is hidden. */
const REFRESH_MS = 5_000;

export type BodyCompositionData = BodyCompositionState & { reload: () => void };

export function useBodyComposition(): BodyCompositionData {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BodyCompositionState>({
    status: 'loading',
    weighing: null,
    profile: null,
    error: null,
  });
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const [weighing, profile] = await Promise.all([
          fetchLatestWeightFromBackend(),
          fetchBodyProfileFromBackend(),
        ]);
        if (!cancelled) setState({ status: 'ok', weighing, profile, error: null });
      } catch (error) {
        if (cancelled) return;
        // Keep the last good reading on screen when a refresh fails.
        setState((previous) => ({
          ...previous,
          status: error instanceof ApiRequestError && error.status === 401 ? 'unauthorized' : 'error',
          error: error instanceof Error ? error.message : 'Could not load the scale data.',
        }));
      } finally {
        pending = false;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    // Catch up immediately when the user returns to the tab.
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [revision]);

  return { ...state, reload };
}
