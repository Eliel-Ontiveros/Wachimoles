import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionStatus,
  DashboardSample,
  SampleMetric,
  VitalSignsData,
} from '../types/vital-signs';
import {
  extractLatestVitals,
  fetchDashboardSamples,
  fetchMetricHistory,
  getInitialEmptyVitals,
} from '../services/vital-signs-api';

// Hook para consultar y sincronizar signos vitales reales
export function useVitalSigns(autoRefreshIntervalMs = 5000) {
  const [vitals, setVitals] = useState<VitalSignsData>(getInitialEmptyVitals());
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Función para consultar los datos en vivo */
  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const samples = await fetchDashboardSamples(100);

      if (!mountedRef.current) return;

      if (samples && samples.length > 0) {
        const latest = extractLatestVitals(samples);
        setVitals(latest);
        setStatus('connected');
      } else {
        setStatus('connected');
        setVitals(getInitialEmptyVitals());
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      const message = err instanceof Error ? err.message : 'Error al conectar con el sensor';
      setErrorMessage(message);
      setStatus('error');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /** Función para obtener el historial completo de una métrica (heart_rate, spo2, stress) */
  const getFullHistory = useCallback(
    async (metric: SampleMetric = 'heart_rate'): Promise<DashboardSample[]> => {
      try {
        const history = await fetchMetricHistory(metric, 300);
        if (history.length > 0) return history;
      } catch {
        // Fallback al historial en memoria
      }
      if (metric === 'spo2') return vitals.spo2History || [];
      if (metric === 'stress') return vitals.stressHistory || [];
      if (metric === 'sleep') return vitals.sleepHistory || [];
      return vitals.pulseHistory || [];
    },
    [vitals.pulseHistory, vitals.spo2History, vitals.stressHistory, vitals.sleepHistory]
  );

  // Carga inicial
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sondeo periódico para detectar nuevos pulsos en tiempo real
  useEffect(() => {
    if (autoRefreshIntervalMs <= 0) return;

    const timer = setInterval(() => {
      refresh();
    }, autoRefreshIntervalMs);

    return () => clearInterval(timer);
  }, [autoRefreshIntervalMs, refresh]);

  return {
    vitals,
    loading,
    status,
    errorMessage,
    refresh,
    getFullHistory,
    isLive: status === 'connected' && vitals.isAvailable,
  };
}
