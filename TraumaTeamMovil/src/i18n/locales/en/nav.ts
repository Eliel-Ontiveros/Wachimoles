import type es from '../es/nav';

/** Navegación (drawer) y cabecera (en). */
const nav: Record<keyof typeof es, string> = {
  'nav.openMenu': 'Open menu',
  'nav.closeMenu': 'Close menu',
  'nav.section': 'NAVIGATION',
  'nav.vitals.subtitle': 'Vital signs, pulse and ECG',
  'nav.body.subtitle': '3D model and injury photos',
  'nav.missions.subtitle': 'Streaks, routines and little ship',
  'nav.assistant': 'Space Health Assistant',
  'nav.assistant.subtitle': 'Research with cited sources',
  'alerts.title': 'Notifications',
  'alerts.empty': 'No new alerts',
  'alerts.markRead': 'Mark as read',
};

export default nav;
