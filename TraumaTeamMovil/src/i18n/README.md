# i18n (es / en)

Español es el idioma por defecto. Idioma activo y persistencia viven en `SettingsProvider`
(`@/settings/SettingsProvider`); `useI18n()` solo lo expone.

```tsx
import { useI18n } from '@/i18n/I18nProvider';
const { t, locale, setLocale, speech } = useI18n();
<Text>{t('vital.title')}</Text>
<Text>{t('common.close')}</Text>
t('action.opening', { label })          // "Abriendo {label}" → params por nombre
```

## Cómo agregar textos
1. Cada área tiene su archivo: `src/i18n/locales/<es|en>/<area>.ts` (default export de un objeto
   `'clave': 'texto'`). Áreas existentes: `common`, `settings`, `nav`, `voice`, `vitals`, `body`, `missions`
   (las tres últimas están vacías, para rellenar).
2. Añade la clave en **es** y en **en** (el `en` está tipado con `Record<keyof typeof es, string>`:
   `tsc` falla si falta una). `messages.ts` ya mezcla todas las áreas; `MessageKey` se deriva de `es`.
3. Las claves son **globales y únicas** entre áreas (lo verifica `npm run test:voice`). Usa prefijo por área:
   `common.*`, `settings.*`, `nav.*`/`alerts.*`, `vital.*` (¡no `vitals.*`, ya lo usa voz!), `body.*`, `missions.*`, y
   para sub-componentes `body.modal.*`, etc. No toques áreas ajenas.
4. Listas/datos mostrados (nombres de misión, entornos, síntomas, músculos): guarda el **id estable** en los datos
   y traduce al mostrar con `t(`missions.title.${id}` as MessageKey)`. Lo que se guarda/envía al backend no cambia.
5. Fuera de componentes (módulos puros): `translate(locale, key, params)` de `@/i18n/messages`.

## Fechas y números
```ts
import { formatDate, formatTime, formatNumber } from '@/i18n/format';
formatDate(date, locale)                                   // "14 nov 2026" / "Nov 14, 2026"
formatDate(date, locale, { weekday: 'long', day: 'numeric' })
formatTime(date, locale)
formatNumber(36.6, locale, { maximumFractionDigits: 1 })   // "36,6" / "36.6"
```
Nunca lanzan (fecha inválida → `''`).

## Voz
STT/TTS/LLM ya usan `locale`/`speech`. Los comandos locales entienden ambos idiomas en `src/voice/parser.ts`.

## Nuevo idioma
Añadir a `LOCALES` + `SPEECH` (messages.ts), carpeta `locales/<code>/` con todas las áreas, y opción en el
selector del drawer.
