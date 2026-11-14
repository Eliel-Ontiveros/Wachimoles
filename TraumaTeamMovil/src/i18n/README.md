# i18n (solo inglés)

La interfaz de la app es **solo en inglés**: `locales/en/**` es el único diccionario y `MessageKey` se deriva de él.
No hay selector de idioma de interfaz ni intención de voz `set-locale`.

```tsx
import { useI18n } from '@/i18n/I18nProvider';
const { t, locale, speech } = useI18n();   // locale es siempre 'en'
<Text>{t('vital.title')}</Text>
t('action.opening', { label })              // "Opening {label}" → params por nombre
```

## Cómo agregar textos
1. Cada área tiene su archivo: `src/i18n/locales/en/<area>.ts` (default export de un objeto `'clave': 'texto'`,
   sin anotar el tipo para que `MessageKey` se infiera). Áreas: `common`, `settings`, `nav`, `voice`, `vitals`, `body`, `missions`.
2. Las claves son **globales y únicas** entre áreas (lo verifica `npm run test:voice`, que además comprueba que cada
   `t('clave')` literal del código exista). Prefijos: `common.*`, `settings.*`, `nav.*`/`alerts.*`, `vital.*`, `body.*`, `missions.*`.
3. Listas/datos mostrados (misiones, entornos, síntomas, músculos): guarda el **id estable** y traduce al mostrar
   (`t(`body.muscle.${id}`)`). Los valores guardados como datos nuevos son en inglés (síntomas `None`, `Zero-G dizziness`,
   `Congestion`, `Fatigue`, `Headache`, títulos `Update N`); los valores heredados en español se aceptan al leer
   (`@/utils/symptoms`, `@/utils/condition-updates`, `normalizeBodyRegion`).
4. Fuera de componentes: `translate(locale, key, params)` de `@/i18n/messages`.

## Fechas y números
`formatDate/formatTime/formatNumber` (`@/i18n/format`) usan siempre `en-US`.

## Voz
- Salida (TTS, mensajes, preguntas del diálogo): siempre inglés (`speech.lang` = `en-US`).
- Entrada (STT): ajuste persistido `voiceLanguage` (`'en'` por defecto | `'es'`) en `SettingsProvider`, con selector
  "Voice input language" en el drawer. `STT_LANG` mapea a `en-US` / `es-ES`.
- `src/voice/parser.ts` y `dialog.ts` entienden español e inglés; sus salidas (nombres de zona, etiquetas) son en inglés.
