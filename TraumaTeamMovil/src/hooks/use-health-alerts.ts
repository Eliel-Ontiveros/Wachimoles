import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HealthAlertsNotReadyError, pendingHealthAlertIds, type HealthAlert } from '../../../shared/health-alerts';
import { acknowledgeHealthAlert, fetchHealthAlerts, subscribeHealthAlerts } from '../services/health-alerts-api';

export function useHealthAlerts() {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const ready = useRef(false);
  const queued = useRef(new Set<string>());
  const revision = useRef(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const seen = useRef(new Set<string>());
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current || !ready.current || !mounted.current || AppState.currentState === 'background') return;
    busy.current = true;
    const version = revision.current;
    try {
      const next = await fetchHealthAlerts();
      if (!mounted.current || version !== revision.current) return;
      const ids = AppState.currentState === 'background' ? [] : pendingHealthAlertIds(next, seen.current, queued.current);
      ids.forEach(id => queued.current.add(id));
      setAlerts(next);
      setQueue(prev => [...prev.filter(id => next.some(a => a.id === id && !a.resolvedAt && !a.acknowledgedAt)), ...ids]);
      setError(null);
    } catch (error) {
      if (mounted.current) setError(error instanceof HealthAlertsNotReadyError
        ? error.message : 'Health alerts could not sync. Retry when connected.');
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void AsyncStorage.getItem('health-alert-deliveries-v1').then(raw => {
      if (raw) {
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids)) ids.filter((id): id is string => typeof id === 'string').forEach(id => seen.current.add(id));
      }
    }).catch(() => {}).finally(() => { ready.current = true; void refresh(); });
    const timer = setInterval(() => { void refresh(); }, 5000);
    const subscription = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') void refresh();
    });
    const unsubscribe = subscribeHealthAlerts(() => { void refresh(); });
    return () => { mounted.current = false; clearInterval(timer); subscription.remove(); unsubscribe(); };
  }, [refresh]);

  const active = foreground ? alerts.find(a => a.id === queue[0]) ?? null : null;
  const markDelivered = useCallback((id: string) => {
    if (seen.current.has(id)) return;
    // Called by the mounted popup, after the startup overlay has finished.
    seen.current.add(id);
    void AsyncStorage.setItem('health-alert-deliveries-v1', JSON.stringify([...seen.current].slice(-1000)))
      .catch(() => {});
  }, []);

  const dismiss = useCallback(() => setQueue(prev => prev.slice(1)), []);
  const acknowledgeAll = useCallback(async () => {
    revision.current += 1;
    const unread = alerts.filter(a => !a.acknowledgedAt);
    const results = await Promise.allSettled(unread.map(a => acknowledgeHealthAlert(a.id)));
    if (!mounted.current) return;
    revision.current += 1;
    const done = new Set(unread.filter((_, i) => results[i].status === 'fulfilled').map(a => a.id));
    setAlerts(prev => prev.map(a => done.has(a.id) ? { ...a, acknowledgedAt: new Date().toISOString() } : a));
    setQueue(prev => prev.filter(id => !done.has(id)));
    setError(results.some(r => r.status === 'rejected') ? 'Some alerts could not be marked as read. Please retry.' : null);
  }, [alerts]);
  return { alerts, active, dismiss, markDelivered, acknowledgeAll, error, refresh };
}
