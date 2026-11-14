# Voice: capability catalog (screens, what they show, their functions) + screen context
Branch feat/voice-commands. Builds on odd/tasks/voice-all-actions.md and odd/tasks/voice-dialog.md (do not break their behaviour).

## Specs
- S1 User (verbatim): "le acabo de pedir que quiere ver los detalles de mi oxígeno y me trajo a esta pantalla. Lo que quiere decir que no permite ingresar a las componentes que hay en nuestra nuestra pantalla. Me gustaría que haya una forma de que el modelo pudiera saber las opciones que tiene disponible, no solo de operaciones de la API, sino también las pantallas que tiene disponible para ver las funciones que tiene cada pantalla, lo que muestra cada pantalla, y con eso poder seleccionar que opción, que pantalla, que comando, qué función se adecua mejor a lo que quiere el usuario."
- S2 "ver los detalles de mi oxígeno" (and "detalles/historial/gráfica/evolución de mi pulso|ritmo cardíaco|oxígeno|estrés|sueño") → vital-history with the right metric, locally and via LLM.
- S3 One capability catalog describes, per screen: route, title, what it shows (components/data), and the actions available there (intent type, params with ranges, when to use, 1-3 example phrases); plus global actions (menu, alerts, help, stop). Screens: "/" Monitoreo Vital (pulse live ECG + pulse history, oxygen card + history, stress card + history, sleep card + history, environment selector + "Plan de vuelo" mission setup, streak badge, space transit timeline, today's missions shortcut, treadmill/steps card), "/explore" Vista Corporal (tabs Vista 3D / Cuestionario / Registros; 3D zone selection, register observation, zone detail, zone photos/timelapse, daily health questionnaire), "/missions" Misiones y Viaje (streak + daily check-in, mission list per environment, environment, arrive early).
- S4 The LLM system prompt is generated from the catalog (no hand-maintained duplicate action list); a test proves every catalog action's example intent passes `sanitizeIntent` and every intent type accepted by `sanitizeIntent` appears in the catalog.
- S5 Each interpret request carries the user's current context `{ screen: '/'|'/explore'|'/missions', tab?: 'body'|'health'|'records' }`; the prompt tells the model where the user is and to prefer that screen's actions when the phrase is ambiguous. Validated in the DTO (optional; unknown keys rejected).
- S6 New intent `describe-screen` {screen?} — "¿qué puedo hacer aquí?", "¿qué hay en esta pantalla?", "qué puedo hacer en misiones" — speaks a short summary of what the screen shows and 3 example commands, and lists them in the voice panel.
- S7 Routing: specific local matches run immediately (fast path); generic local matches (a bare screen/metric keyword resolved only to `navigate`) are low confidence and are sent to the LLM with context first; if the LLM is unavailable or fails, the local result runs.

## Tasks
- T1 S3-S6 backend catalog, prompt generation, context DTO, describe-screen whitelist — worker
- T2 S2,S5-S7 app catalog mirror for describe-screen/help, context in requests, confidence routing, parser fix — worker (after voice-dialog T2 lands)

## Log
- L1 Screenshot: "ver los detalles de mi oxígeno" went to Monitoreo Vital instead of opening the oxygen history.
