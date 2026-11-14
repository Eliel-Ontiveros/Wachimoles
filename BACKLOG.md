# Trauma Team — Task Backlog (draft)

Draft for review. Nothing here has been published as GitHub issues.
Fields: **Component** (Mobile / Backend / Watch / Web / Docs / Infra), **Priority** (P0 critical, P1 important, P2 nice to have), **Size** (XS, S, M, L, XL).
Source: project README (Nov 13, 2026), repository state, and team notes.

Suggested order: Epic A -> B -> C -> D/E/F/G/H in parallel -> I.

---

## Epic A — Consolidate the prototype

### A1. Migrate the whole system to English
Component: Mobile, Backend, Watch, Docs | Priority: P0 | Size: XL
Context: English is required for the entire system. The repo still has Spanish UI strings, comments, docs, env identifiers, anatomical categories and symptom values. Some are validated by the API and constrained in SQL.
Acceptance criteria:
- [ ] No Spanish user-facing strings in mobile and watch UI.
- [ ] Comments and component docs translated.
- [ ] Spanish enum values (anatomical categories, symptoms) migrated across frontend, backend validation and SQL constraints.
- [ ] A migration converts existing rows so stored data stays readable.
Tip: split into sub-issues: A1a UI strings (Mobile), A1b enum + DB migration (Backend), A1c comments and docs.

### A2. Translate and fix the component READMEs
Component: Docs | Priority: P1 | Size: S
Context: Mobile README is the unmodified Expo template. Backend README references `Wachimoles_Movil_Frontend`/`Wachimoles_Movil_Backend` and contains a truncated command (`npm tes`). Watch README is in Spanish with legacy paths.
Acceptance criteria:
- [ ] Each component README is in English, accurate to the current layout, and has working setup commands.
- [ ] Root README added (the one provided by the team).

### A3. Persist mission settings and environment in the backend
Component: Mobile, Backend | Priority: P0 | Size: M
Context: Environment (Earth / spacecraft / Moon / Mars), origin, destination and dates live in React state; backend persistence is unfinished. This is a prerequisite for location-aware AI (Epic B).
Acceptance criteria:
- [ ] Table and endpoints to save and load mission context per user.
- [ ] App restores mission context after restart.
- [ ] UI states the environment is selected or calculated from dates, not measured telemetry.

### A4. Finish injury photo upload and retrieval
Component: Mobile, Backend | Priority: P1 | Size: L
Context: Photo metadata is in memory; the upload helper targets an endpoint that does not exist.
Acceptance criteria:
- [ ] Backend endpoint plus storage bucket for photos, linked to a body zone and timestamp.
- [ ] Photo sequence persists across sessions.
- [ ] Upload failures are surfaced and retryable.

### A5. Recoverable synchronization on failure
Component: Mobile | Priority: P1 | Size: M
Context: Failed saves of body observations/questionnaires are not recoverable.
Acceptance criteria:
- [ ] Failed saves are queued locally and retried.
- [ ] User sees pending/failed sync state.

---

## Epic B — Location-aware AI assistance (clinical data based on the astronaut's location)

### B1. Define the mission-context payload for AI requests
Component: Backend | Priority: P0 | Size: S
Depends on: A3
Acceptance criteria:
- [ ] Documented schema: environment, mission phase, available equipment, symptoms, body zone, pain, recent readings.
- [ ] Missing context is represented explicitly, never invented.

### B2. Select and integrate an AI provider
Component: Backend | Priority: P0 | Size: M
Context: No AI provider is selected in the current code.
Acceptance criteria:
- [ ] Decision documented (provider, cost, latency, data handling).
- [ ] Server-side integration; API keys never reach the client.
- [ ] Timeouts and failure fallback in place.

### B3. Environment-specific interpretation of readings and alerts
Component: Backend, Mobile | Priority: P1 | Size: L
Context: Alert thresholds are fixed prototype rules, not adapted to location.
Acceptance criteria:
- [ ] Interpretation changes by environment (e.g. reduced gravity, radiation, confinement).
- [ ] The response states how the context affected the interpretation.
- [ ] Thresholds per environment are documented with their source.

### B4. "Ask the assistant" flow in the app
Component: Mobile | Priority: P1 | Size: M
Acceptance criteria:
- [ ] From a body zone/symptom report, user can request assistance.
- [ ] Shows response, uncertainty and next steps; clear disclaimer that it is not a validated diagnosis.

---

## Epic C — RAG grounded in challenge and medical resources

### C1. Curate and version the resource collection
Component: Docs | Priority: P0 | Size: M
Acceptance criteria:
- [ ] List of resources from the NASA Space Apps challenge plus space-health references, with license/source.
- [ ] Versioned in the repo or storage with a manifest.

### C2. Ingestion pipeline: chunking and embeddings
Component: Backend | Priority: P0 | Size: L
Depends on: C1
Acceptance criteria:
- [ ] Script extracts text, splits into passages and stores embeddings (e.g. pgvector in Supabase).
- [ ] Each passage keeps source, page/section and version.

### C3. Retrieval and grounded generation
Component: Backend | Priority: P0 | Size: L
Depends on: B2, C2
Acceptance criteria:
- [ ] Symptoms + body zone + readings + environment drive retrieval.
- [ ] Answer includes citations to retrieved passages.
- [ ] Explicit "insufficient evidence" response when nothing relevant is found.

### C4. Evaluation set of reviewed scenarios
Component: Backend, Docs | Priority: P1 | Size: M
Acceptance criteria:
- [ ] At least 10 representative scenarios (different environments and zones) with expected behavior.
- [ ] Repeatable script reports grounding and citation quality.

### C5. Citations UI
Component: Mobile | Priority: P1 | Size: S
Acceptance criteria:
- [ ] Each supported statement links to its source passage.

---

## Epic D — Connected scale and body measurements

### D1. Select scale hardware and protocol
Component: Mobile, Docs | Priority: P1 | Size: S
Acceptance criteria:
- [ ] Documented choice (e.g. BLE scale), what it provides, and mass vs force-weight handling for each gravity environment.

### D2. Scale integration (BLE) with provenance
Component: Mobile | Priority: P1 | Size: L
Depends on: D1
Acceptance criteria:
- [ ] Measurements imported with unit, timestamp and device provenance.
- [ ] Visible connection/sync status.
- [ ] Manual entry fallback.

### D3. Persist body measurements
Component: Backend | Priority: P1 | Size: M
Acceptance criteria:
- [ ] Table and endpoints; values flow into daily check-in and derived indicators.

---

## Epic E — Voice commands

### E1. Choose speech-to-text approach
Component: Mobile, Docs | Priority: P1 | Size: S
Acceptance criteria:
- [ ] Decision on library/service, offline support and permissions; English only.

### E2. Voice command engine for navigation shortcuts
Component: Mobile | Priority: P1 | Size: L
Depends on: E1
Acceptance criteria:
- [ ] Commands: open vital signs, start daily check-in, go to body zone.
- [ ] Visible feedback and graceful recovery from unrecognized commands.

### E3. Voice dictation for observations and check-ins
Component: Mobile | Priority: P2 | Size: M
Acceptance criteria:
- [ ] Dictate notes/symptoms; user reviews recognized text before saving a health record.

---

## Epic F — Derived medical indicators

### F1. Research formulas and select indicators
Component: Docs | Priority: P1 | Size: M
Acceptance criteria:
- [ ] Document per indicator: source, inputs, units, assumptions, environment applicability.
- [ ] Short, manageable list agreed by the team (avoid overwhelming the user).

### F2. Implement the calculation module
Component: Mobile or Backend | Priority: P1 | Size: M
Depends on: F1
Acceptance criteria:
- [ ] Pure functions with unit tests using known reference values.
- [ ] Withholds result when inputs are missing or unsuitable.

### F3. Show derived indicators as estimates
Component: Mobile | Priority: P1 | Size: M
Acceptance criteria:
- [ ] Labeled as estimates, with input provenance and limitations; never presented as sensor measurements.

---

## Epic G — UI redesign and gamification

### G1. Screen redesign for the hackathon
Component: Mobile | Priority: P0 | Size: XL
Context: Implement what the designer delivers.
Acceptance criteria:
- [ ] Designs received and broken down per screen as sub-issues.
- [ ] Screens implemented consistently (shared tokens/components).
Blocked by: designer deliverables.

### G2. Review and evaluate gamification
Component: Mobile, Docs | Priority: P1 | Size: S
Acceptance criteria:
- [ ] Short review of what helps routines vs distracts; decision list of mechanisms to keep or add.

### G3. Persist gamification progress
Component: Mobile, Backend | Priority: P1 | Size: M
Acceptance criteria:
- [ ] Streaks, daily completion and activity goals survive restarts and stay consistent across days.

### G4. Health-safe gamification rules
Component: Mobile | Priority: P2 | Size: M
Acceptance criteria:
- [ ] Goals adapt to symptoms and rest; no reward for hiding symptoms or over-exertion.

---

## Epic H — Security and data quality

### H1. Replace the shared `EXPO_PUBLIC_DASHBOARD_API_TOKEN`
Component: Mobile, Backend | Priority: P0 | Size: L
Acceptance criteria:
- [ ] User session or revocable per-device credentials; no secret embedded in the client build.

### H2. Authenticate watch ingestion per device
Component: Watch, Backend | Priority: P1 | Size: M
Acceptance criteria:
- [ ] `POST /api/samples` requires device identity; invalid/unknown devices rejected.

### H3. Multi-user support
Component: Backend, Mobile | Priority: P2 | Size: L
Context: Currently one fixed `DASHBOARD_USER_ID`.
Acceptance criteria:
- [ ] Data keyed by the authenticated user; explicit ownership filters kept.

### H4. Offline upload queue and stale-data indicators
Component: Watch, Mobile | Priority: P2 | Size: L
Acceptance criteria:
- [ ] Retry queue on the watch/side service; UI distinguishes fresh vs stale readings.

### H5. Replace 5-second polling with SSE or Realtime
Component: Mobile, Backend | Priority: P2 | Size: M

### H6. Self-host the 3D viewer dependencies
Component: Mobile | Priority: P2 | Size: S
Context: Three.js is loaded from external CDNs.

---

## Epic I — Web and infrastructure

### I1. Define scope and scaffold `TraumaTeamWeb`
Component: Web | Priority: P2 | Size: M
Context: Contains only a placeholder README.

### I2. Backend test coverage for the dashboard module
Component: Backend | Priority: P1 | Size: M
Context: Only an environment-validation spec exists.

### I3. CI with GitHub Actions per component
Component: Infra | Priority: P1 | Size: M
Acceptance criteria:
- [ ] Mobile: lint + `tsc --noEmit`. Backend: tests + build. Watch API: tests.

### I4. EAS build pipeline for the mobile app
Component: Mobile, Infra | Priority: P2 | Size: M
