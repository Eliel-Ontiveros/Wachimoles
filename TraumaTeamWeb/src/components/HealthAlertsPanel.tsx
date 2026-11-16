import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { HEALTH_ALERTS_NOT_READY_MESSAGE, HealthAlertsNotReadyError, type HealthAlert } from '../../../shared/health-alerts.ts';
import { acknowledgeHealthAlert, fetchHealthAlerts } from '../services/backend-api';
import { BellIcon } from './Icons';
import { displayReportText } from '../utils/display-labels.ts';
import './HealthAlertsPanel.css';

export function HealthAlertsPanel({ astronautName, onViewMuscle }: {
  astronautName: string;
  onViewMuscle: (id: string) => void;
}) {
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [pending, setPending] = useState<string | null>(null);
  const revision = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  const detailsId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    closeRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);
  const refresh = useCallback(async () => {
    if (busy.current || !mounted.current) return;
    busy.current = true;
    const version = revision.current;
    try {
      const next = await fetchHealthAlerts();
      if (mounted.current && version === revision.current) { setAlerts(next); setError(null); setLoaded(true); }
    } catch (error) {
      if (mounted.current) setError(error instanceof HealthAlertsNotReadyError
        ? error.message : 'Alerts could not sync. The last received alerts remain visible. Retry to reconnect.');
    } finally { busy.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(refresh);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  const acknowledge = async (id: string) => {
    if (pending) return;
    setPending(id);
    revision.current += 1;
    try {
      await acknowledgeHealthAlert(id);
      if (!mounted.current) return;
      revision.current += 1;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledgedAt: new Date().toISOString() } : a));
      setError(null);
    } catch {
      if (mounted.current) setError('This alert could not be marked as reviewed. Please retry.');
    } finally { if (mounted.current) setPending(null); }
  };
  const setupRequired = error === HEALTH_ALERTS_NOT_READY_MESSAGE;
  const active = alerts.filter(a => !a.resolvedAt);
  const unread = active.filter(a => !a.acknowledgedAt).length;
  const critical = active.some(a => a.severity === 'critical');
  const visible = alerts.filter(a => tab === 'active' ? !a.resolvedAt : Boolean(a.resolvedAt))
    .sort((a, b) => Number(Boolean(a.acknowledgedAt)) - Number(Boolean(b.acknowledgedAt)) ||
      Number(b.severity === 'critical') - Number(a.severity === 'critical') || b.createdAt.localeCompare(a.createdAt));

  const closeInbox = () => { setExpanded(false); triggerRef.current?.focus(); };
  return <div className={`health-alerts ${critical ? 'has-critical' : ''}`} ref={wrapperRef}
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
    <button ref={triggerRef} className="health-alerts-toggle" type="button"
      aria-label={`Notifications, ${error ? 'sync unavailable' : `${unread} unread alerts`} for ${astronautName}`}
      title={setupRequired ? 'Notifications · setup required' : error ? 'Notifications · connection issue' : 'Notifications'}
      aria-expanded={expanded} aria-controls={detailsId} aria-haspopup="dialog"
      aria-busy={!loaded && !error} onClick={() => setExpanded(v => !v)}>
      <BellIcon />
      {unread > 0 && <span className="health-alerts-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      {error && <span className="health-alerts-connection-dot" aria-hidden="true" />}
    </button>
    <span className="health-alerts-sr" role="status">{error ? 'Notifications could not sync' : loaded ? `${unread} unread health alerts` : 'Loading notifications'}</span>
    {expanded && <div className="health-alerts-details" id={detailsId} role="dialog" aria-modal="false" aria-labelledby={`${detailsId}-title`}>
      <div className="health-alerts-heading">
        <div><h2 id={`${detailsId}-title`}>Notifications</h2></div>
        <button ref={closeRef} type="button" className="health-alerts-close" aria-label="Close notifications" onClick={closeInbox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="health-alerts-toolbar">
        <div role="group" aria-label="Filter health alerts">
          <button type="button" aria-pressed={tab === 'active'} onClick={() => setTab('active')}>Active ({active.length})</button>
          <button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History ({alerts.length - active.length})</button>
        </div>
      </div>
      {error && <p className="health-alerts-error" role="alert">{error} <button onClick={() => void refresh()}>Retry</button></p>}
      {!loaded && !error && <p className="health-alerts-empty" role="status">Loading alerts…</p>}
      {loaded && visible.length === 0 && <p className="health-alerts-empty">{tab === 'active' ? 'No active health alerts.' : 'No resolved health alerts yet.'}</p>}
      <ul className="health-alerts-list">
        {visible.map(a => <li key={a.id} className={a.severity === 'critical' ? 'critical' : 'warning'}>
          <div className="health-alerts-record">
            <div className="health-alerts-record-title"><strong>{a.rule === 'pain_threshold' ? `High pain · ${displayReportText(a.muscleName ?? a.muscleId ?? 'Body zone')}` : 'Multiple active problems'}</strong><b>{a.rule === 'pain_threshold' ? `${a.value}/10` : `${a.value} problems`}</b></div>
            <p>{a.rule === 'pain_threshold' ? `Pain reached the ${a.threshold}/10 threshold.` : `${a.value} active problems; alert starts at ${a.threshold}.`} {a.resolvedAt ? 'Threshold no longer met.' : 'Review the astronaut’s reports.'}</p>
            <div className="health-alerts-meta"><span>{a.resolvedAt ? 'Resolved' : a.severity === 'critical' ? 'Critical' : 'Warning'} · {a.acknowledgedAt ? 'Reviewed by monitoring' : 'Needs review'}</span><time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
          </div>
          <div className="health-alerts-actions">
            {a.muscleId && <button type="button" onClick={() => { onViewMuscle(a.muscleId!); closeInbox(); }}>View zone</button>}
            {!a.acknowledgedAt && <button type="button" disabled={pending !== null} onClick={() => void acknowledge(a.id)}>{pending === a.id ? 'Saving…' : 'Mark reviewed'}</button>}
          </div>
        </li>)}
      </ul>
    </div>}
  </div>;
}
