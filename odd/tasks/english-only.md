# English-only interfaces (backend, mobile, web)
Branch feat/english-only (from main 69ff6de).

## Specs
- S1 User (verbatim): "Debemos modificar algo: tanto back, como movil, como web TODO debe quedar solamente en ingles. Comandos de voz si pueden estar en espanol tambien, pero todas las interfaces si deben estar en ingles"
- S2 Every user-visible text is English only: mobile screens/modals/alerts/accessibility labels/permission strings (app.json), web UI (incl. index.html title/lang), backend API error messages and LLM replies/clarifications/spoken feedback.
- S3 Voice INPUT may be Spanish or English: the local parser and dialog engine keep understanding Spanish phrasings/answers; the LLM prompt tells the model to understand Spanish and English input but ALWAYS answer (`message`) in English. TTS speaks English. STT language: a "Voice input language" setting (English / Español) in mobile Settings, default English (en-US); Spanish selects es-ES. Persisted like the other settings.
- S4 The UI language selector and the `set-locale` voice intent are removed (UI is English only); the theme switch stays. `set-theme` stays. i18n infrastructure (t(), dictionaries) stays with English as the only UI dictionary; delete the Spanish UI dictionaries and the key-parity test becomes a single-locale/no-missing-key check (keep tests green).
- S5 Stored/sent data: ids and enum values never change. Labels stored as data (symptom names such as "Ninguno/Mareo 0g/Congestión/Fatiga/Cefalea", default photo note "Registro fotográfico diario", condition/update text, "Actualización N" titles) become English for NEW data; legacy Spanish values already stored must keep working: backend DTO/validation accepts both legacy Spanish and English symptom values, and clients display legacy Spanish values in English via a small mapping when known. Muscle names shown come from muscle id → English name.
- S6 Number/date formatting uses the en-US locale. No Spanish left in UI source (verify with a grep for accented chars and common Spanish words, excluding: the voice parser/dialog input vocabulary, tests, docs, comments).
- S7 Comments/docs/READMEs are out of scope (report what remains).

## Tasks
- T1 backend (S2,S3,S5) — worker
- T2 mobile (S2-S6) — worker
- T3 web (S2,S5,S6) — worker

## Log
- L1 the S1 request.
