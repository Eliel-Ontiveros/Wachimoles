/**
 * Diccionarios de la app. Para agregar un idioma: añade el código a `LOCALES`,
 * su configuración de voz a `SPEECH` y un diccionario con las mismas claves
 * que `es` (TypeScript avisa si falta alguna).
 */
export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Idioma del reconocedor (STT) y de la voz (TTS) por locale. */
export const SPEECH: Record<Locale, { lang: string; voicePrefix: string }> = {
  es: { lang: 'es-ES', voicePrefix: 'es' },
  en: { lang: 'en-US', voicePrefix: 'en' },
};

const es = {
  'route./': 'Monitoreo Vital',
  'route./explore': 'Vista Corporal',
  'route./missions': 'Misiones y Viaje',
  'tab.body': 'Vista 3D',
  'tab.health': 'Cuestionario',
  'tab.records': 'Registros',

  'voice.title': 'Control por voz',
  'voice.listening': 'Te escucho…',
  'voice.dictating': 'Dictando… habla ahora',
  'voice.thinking': 'Pensando…',
  'voice.tapToTalk': 'Toca la esfera y habla',
  'voice.typePlaceholder': 'O escribe un comando…',
  'voice.typePlaceholderNoMic': 'Sin micrófono: escribe un comando…',
  'voice.talk': 'Hablar con la app',
  'voice.stopListening': 'Detener escucha',
  'voice.close': 'Cerrar control por voz',
  'voice.dictate': 'Dictar',
  'voice.dictateNote': 'Dictar nota',
  'voice.dictateObservation': 'Dictar observación',

  'warp.heading': 'Rumbo a',

  'action.opening': 'Abriendo {label}',
  'action.menuOpened': 'Menú abierto',
  'action.menuClosed': 'Menú cerrado',
  'action.alerts': 'Tienes {count} alertas sin leer. Toca la campana para verlas.',
  'action.alertsAck': 'Alertas marcadas como leídas',
  'action.checkin': 'Iniciando chequeo diario',
  'action.zone': 'Zona: {name}',
  'action.treadmill': 'Rutina de cinta alternada',
  'action.cancelled': 'Cancelado',
  'action.help': 'Prueba: "abre signos vitales", "iniciar chequeo diario", "ve al bíceps derecho".',
  'action.dictated': 'Texto dictado. Revísalo antes de guardar.',

  'vitals.pulse': 'pulso {value} latidos por minuto',
  'vitals.spo2': 'oxígeno {value} por ciento',
  'vitals.stress': 'estrés {value}',
  'vitals.none': 'Aún no hay datos del reloj.',

  'parse.empty': 'No te escuché. Intenta de nuevo.',
  'parse.unknown': 'No entendí. Prueba: "abre signos vitales", "iniciar chequeo diario" o "ve al bíceps derecho".',
  'parse.ambiguous': '¿{zone} derecho o izquierdo?',

  'llm.notConfigured': 'IA no configurada: falta EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_DASHBOARD_API_TOKEN en la app.',
  'llm.unreachable': 'IA no disponible: no se pudo contactar el backend (¿está corriendo? ¿CORS_ORIGINS incluye este origen?).',
  'llm.disabled': 'IA no disponible: el backend no tiene DEEPSEEK_API_KEY.',
  'llm.failed': 'La IA no pudo procesar la frase. Intenta de nuevo.',

  'error.unsupported': 'Este dispositivo o navegador no soporta reconocimiento de voz.',
  'error.notAllowed': 'Permiso de micrófono denegado. Actívalo en los ajustes del navegador o del teléfono.',
  'error.serviceNotAllowed': 'El servicio de voz no está permitido. Usa Chrome/Edge/Safari (no un navegador embebido) y permite el micrófono.',
  'error.network': 'El reconocimiento de voz necesita conexión a internet (el navegador usa un servicio en la nube). Revisa tu red o prueba en Chrome.',
  'error.audioCapture': 'No se detectó ningún micrófono. Conéctalo o revisa los permisos.',
  'error.language': 'Idioma de voz no disponible en este dispositivo.',
  'error.silent': 'No te escuché. Toca la esfera y vuelve a intentar.',
  'error.generic': 'Error de voz ({code})',

  'examples': 'Abre signos vitales|¿Cómo va mi ritmo cardíaco?|Iniciar chequeo diario|Me duele la espalda izquierda|Ir a misiones',
};

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
  'route./': 'Vital Monitoring',
  'route./explore': 'Body View',
  'route./missions': 'Missions & Journey',
  'tab.body': '3D View',
  'tab.health': 'Questionnaire',
  'tab.records': 'Records',

  'voice.title': 'Voice control',
  'voice.listening': 'Listening…',
  'voice.dictating': 'Dictating… speak now',
  'voice.thinking': 'Thinking…',
  'voice.tapToTalk': 'Tap the orb and speak',
  'voice.typePlaceholder': 'Or type a command…',
  'voice.typePlaceholderNoMic': 'No microphone: type a command…',
  'voice.talk': 'Talk to the app',
  'voice.stopListening': 'Stop listening',
  'voice.close': 'Close voice control',
  'voice.dictate': 'Dictate',
  'voice.dictateNote': 'Dictate note',
  'voice.dictateObservation': 'Dictate observation',

  'warp.heading': 'Heading to',

  'action.opening': 'Opening {label}',
  'action.menuOpened': 'Menu opened',
  'action.menuClosed': 'Menu closed',
  'action.alerts': 'You have {count} unread alerts. Tap the bell to see them.',
  'action.alertsAck': 'Alerts marked as read',
  'action.checkin': 'Starting daily check-in',
  'action.zone': 'Zone: {name}',
  'action.treadmill': 'Treadmill routine toggled',
  'action.cancelled': 'Cancelled',
  'action.help': 'Try: "open vital signs", "start daily check-in", "go to right biceps".',
  'action.dictated': 'Text dictated. Review it before saving.',

  'vitals.pulse': 'heart rate {value} beats per minute',
  'vitals.spo2': 'oxygen {value} percent',
  'vitals.stress': 'stress {value}',
  'vitals.none': 'No watch data yet.',

  'parse.empty': "I didn't hear you. Try again.",
  'parse.unknown': 'I did not understand. Try: "open vital signs", "start daily check-in" or "go to right biceps".',
  'parse.ambiguous': '{zone}: right or left?',

  'llm.notConfigured': 'AI not configured: set EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_DASHBOARD_API_TOKEN in the app.',
  'llm.unreachable': 'AI unavailable: could not reach the backend (is it running? does CORS_ORIGINS include this origin?).',
  'llm.disabled': 'AI unavailable: the backend has no DEEPSEEK_API_KEY.',
  'llm.failed': 'The AI could not process the phrase. Try again.',

  'error.unsupported': 'This device or browser does not support speech recognition.',
  'error.notAllowed': 'Microphone permission denied. Enable it in your browser or phone settings.',
  'error.serviceNotAllowed': 'Speech service not allowed. Use Chrome/Edge/Safari (not an embedded browser) and allow the microphone.',
  'error.network': 'Speech recognition needs an internet connection (the browser uses a cloud service). Check your network or try Chrome.',
  'error.audioCapture': 'No microphone detected. Connect one or check permissions.',
  'error.language': 'Speech language not available on this device.',
  'error.silent': "I didn't hear you. Tap the orb and try again.",
  'error.generic': 'Voice error ({code})',

  'examples': 'Open vital signs|How is my heart rate?|Start daily check-in|My left back hurts|Go to missions',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { es, en };

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const template = MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key];
  return params
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
    : template;
}
