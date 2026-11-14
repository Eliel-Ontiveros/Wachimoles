# Voice: cover every app action
Branch feat/voice-commands. Voice (local parser + DeepSeek fallback) must reach every user-facing action, not only navigation.

## Specs
- S1 User (verbatim): "no tiene bien implementadas todas las funciones" — example that failed: "Quiero registrar una molestia en el hombro izquierdo".
- S2 Health records are never saved silently: voice opens the form prefilled (observation modal, daily questionnaire) and the user reviews and taps save (issue #20 rule: "user reviews recognized text before saving a health record").
- S3 Shared intent contract (app `src/voice/parser.ts` VoiceIntent, backend `src/voice/voice-intent.ts` sanitizeIntent) adds:
  - register-observation {muscleId, painIntensity? int 1-10, swelling? bool, functionalLimitation? bool, notes? ≤300}
  - zone-detail {muscleId}, zone-photos {muscleId}
  - set-environment {environment: tierra|nave|luna|marte}
  - open-mission-setup, arrive-early
  - complete-mission {missionId ∈ daily-checkin, treadmill-steps, env-tierra-cardio, env-tierra-core, env-nave-ared, env-nave-stretch, env-luna-eva, env-luna-balance, env-marte-load, env-marte-resp}
  - fill-health-check {bloodSugarMgDl? 20-600, systolicBp? 50-260, diastolicBp? 30-160, temperatureC? 30-45, sleepHours? 0-24, mood? int 1-5, symptoms? ⊆ [Ninguno, Mareo 0g, Congestión, Fatiga, Cefalea], notes? ≤300}
  - vital-history {metric: heart_rate|spo2|stress|sleep}
  - dismiss-alert; open-alerts now really opens the bell modal.
- S4 The LLM reply is whitelisted: out-of-range numbers / unknown ids are dropped (field) or reject the intent (required ids).

## Tasks
- T1 S3,S4 backend intent whitelist + prompt — worker — done (backend commit "feat(voice): whitelist every app action for the LLM")
- T2 S1-S3 app parser + UI channels + components — worker — done (commit "feat(voice): reach every app action by voice")

## Log
- L1 "no tiene bien implementadas todas las funciones" (screenshot: "Quiero registrar una molestia en el hombro izquierdo" → "La IA no pudo procesar la frase").
- L2 Backend on :3010 runs latest code; failure was a non-503 HTTP error from /voice/interpret. Added DeepSeek status logging (commit after b061d78).
- L3 T1 fa00278 (28 backend tests). T2: 17 parser tests, tsc/eslint voice clean, web export ok; not exercised by hand. VitalMonitorView lint 19→20 (set-state-in-effect for opening history).
