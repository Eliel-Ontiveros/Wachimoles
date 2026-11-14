# Voice control (Epic E)

Hands-free control of TraumaTeam on **mobile (iOS/Android) and web** from a single codebase.

## E1 — Speech-to-text decision
- **Library:** `expo-speech-recognition`. It uses the native recognizers on iOS (`SFSpeechRecognizer`) and Android (`SpeechRecognizer`), and the Web Speech API in browsers (Chrome/Edge/Safari).
- **Offline:** on-device recognition is available on iOS 13+/Android 13+ (`requiresOnDeviceRecognition`); the default uses the OS service. Command *interpretation* is always fully offline.
- **Permissions:** microphone and speech recognition, declared in `app.json` via the config plugin. Denial is handled with a visible message and a typed-command fallback.
- **Language:** Spanish (`es-ES`) is the recognizer language; the parser understands Spanish and English phrasing.
- **Build:** native code, so it needs a development build (`npx expo run:ios|android` / EAS), not Expo Go. Web works with `npx expo start --web`.
- **Spoken feedback:** `expo-speech` (TTS) confirms each action.

## E2 — Command engine (`src/voice/`)
`parser.ts` is a pure natural-language → intent interpreter (accent/punctuation insensitive, typo tolerant, synonyms like "me duele la espalda izquierda"). `VoiceProvider` runs STT → parser → real app actions (navigation, menu, alerts, body zone selection, daily check-in, treadmill routine, reading vitals aloud). `VoiceFab` shows the mic button, live transcript and result; unrecognized or ambiguous input (e.g. a side-less "bíceps") gives a hint instead of failing silently.

Examples: "abre signos vitales", "iniciar chequeo diario", "ve al bíceps derecho", "marcar alertas como leídas", "ayuda".

## E3 — Dictation
`DictationButton` fills the notes field of the daily check-in and body observation. Text is only placed in the input: the user reviews it before saving.

## Tests
`npm run test:voice` (parser, Node built-in runner).

## LLM fallback (DeepSeek)
When the local parser returns `unknown`, the app calls `POST /voice/interpret` on the backend, which asks DeepSeek (`deepseek-chat`, JSON mode, temperature 0) to map the phrase to one action. The key never reaches the client.
- The model output is **never trusted**: `sanitizeIntent` rebuilds the intent from a whitelist (routes, tabs, 36 muscle ids), so hallucinated or prompt-injected output is dropped.
- If the key is missing, the service is down or it times out (8 s), the app silently falls back to the local hint.
- Config (backend env): `DEEPSEEK_API_KEY` (enables it), optional `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`.
- Web needs the app origin in `CORS_ORIGINS`.
