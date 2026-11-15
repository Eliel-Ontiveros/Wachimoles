# Health alerts

Health alerts extend the existing mobile notification bell and foreground popup. Ground monitoring gets a notification bell next to the astronaut in the header. It opens an inbox with active alerts, history, links to body zones and a **Mark reviewed** action. Existing UI copy remains English.

| Rule | Trigger | Severity | Clear condition |
| --- | --- | --- | --- |
| Pain | An active body condition has pain ≥8/10 | Critical | Pain drops below 8, or the condition is resolved/deleted |
| Active problems | An astronaut has ≥4 active body conditions | Warning | Active count drops below 4 |

The problem count means distinct active body conditions, not questionnaire symptoms, repeated updates, resolved reports or a rolling 24-hour window. These thresholds implement the requested product rules; they are not clinical diagnostic criteria.

## Persistence and delivery

`health_alerts` stores an episode per astronaut and rule/source. PostgreSQL triggers evaluate every insert, update and deletion of a body condition in the same transaction as the report. A unique partial index prevents duplicate open episodes. A per-astronaut transaction lock serializes report writes. Existing qualifying conditions are backfilled when the migration runs.

While a threshold stays exceeded, subsequent reports update the same episode. Acknowledging an episode does not resolve the underlying problem. Dropping below the threshold closes the episode; a later crossing creates a new unread episode.

Mobile and monitoring acknowledgements have separate timestamps. Mobile popups queue critical episodes first and avoid reappearing on each poll. Delivery IDs are stored locally only when the mounted popup is displayed, after startup; medical report details stay on the server. Dismissing a popup leaves the notification unread until **Mark as read** succeeds. A closed or backgrounded app receives the persisted inbox on its next foreground sync.

Both clients poll every 5 seconds while active; mobile also refreshes after a successfully saved condition and when returning to the foreground. A failed sync retains the previous inbox and exposes a retry action. Failed acknowledgements remain unread. The API returns up to 500 episodes, placing open episodes ahead of resolved history.

This uses the app's existing in-app notifications. There is no OS push delivery while the app is terminated; the project has no push registration/provider infrastructure. Native device acceptance remains a separate check.

## API and current identity model

- `GET /dashboard/alerts/mobile`
- `GET /dashboard/alerts/monitor`
- `POST /dashboard/alerts/:audience/:id/acknowledge`

Requests accept the existing Bearer token or dashboard Basic credentials. Audience must be `mobile` or `monitor`, and acknowledgement IDs must be UUIDs. Reads and writes always scope to the server's `DASHBOARD_USER_ID`; clients cannot choose another subject via query parameters. Like the existing dashboard, this is the configured astronaut connection, not a new multi-user login system. Storage supports separate astronaut IDs. Direct table/function access by `anon` and `authenticated` roles is denied; the backend uses its existing service role. Do not expose the service-role key in either client.

## Rollout

Apply `Wachimoles_Backend/supabase/migrations/20261115_add_health_alerts.sql` to the same Supabase project as `body_conditions`, after the existing body-condition migration. Deploy the backend and both clients together. Without that migration, the new endpoints show an explicit storage/sync error rather than claiming there are no alerts.

The migration was applied to the configured Supabase project on November 14, 2026 through its authenticated SQL Editor. Both mobile and monitoring API endpoints returned 200, and the backfilled episodes matched the current reports. This does not deploy the application builds.

## Validation

From `Wachimoles_Backend` run `npm run build`, `npm test` and `npm run test:alerts:sql`. The SQL test runs the actual migrations and triggers in isolated PostgreSQL via PGlite: backfill, 7/8 pain boundary, 3/4 count boundary, repeated updates, independent acknowledgements, recurrence, resolution/deletion, user isolation, transaction rollback and denied direct access. HTTP/storage tests cover authentication, parameter validation, subject scoping, idempotent acknowledgement and missing records.

From `TraumaTeamWeb/TraumaTeamWeb` run `npm run build`, `npm run lint` and `npm test`. Tests cover the wire contract, popup eligibility/order, recurring episodes, web authentication and acknowledgement failures.

From `TraumaTeamMovil` run `./node_modules/.bin/tsc --noEmit`, `npm run lint` and `npm run test:voice`. Check the popup and notification inbox on an actual iOS/Android device before release, including app restart, foreground/background, offline retry, screen reader and large text.

Local validation on November 14, 2026: backend build and all 105 Jest tests pass; the PostgreSQL migration/trigger test passes; web build, tests and lint pass (one existing hook-dependency warning); mobile TypeScript and existing voice/i18n tests pass. New/changed alert components pass focused lint with one existing warning in `MissionProvider`. Full mobile lint still reports existing errors in `HealthQuestionnaireSection`, `use-vital-signs` and `VoiceButton`. Browser checks with synthetic data exercised the pain popup, queued problem-count popup, mobile inbox, independent monitoring/mobile acknowledgement, web active/history filters, and disconnect/recovery. Browser mobile rendering is not native iOS/Android acceptance.

## Missing-schema diagnosis

If the backend returns `503` and Supabase reports `PGRST205` (or PostgreSQL `42P01`) for `public.health_alerts`, the alert migration has not been applied to that project. The API now identifies this as `HEALTH_ALERTS_NOT_READY`, and both clients show a setup message instead of treating it as an ordinary network interruption. A service-role REST key can read and write existing tables but does not provide a SQL migration connection. Apply the migration through an authenticated SQL Editor session or an authorized database connection, then retry the inbox. Do not return an empty list to conceal missing storage.

The web inbox is opened from the compact header bell next to the astronaut. Its badge counts active, unreviewed episodes. Escape and the close button restore focus to the bell; clicking outside or moving focus out dismisses the inbox. The panel was checked at desktop width and 390 px without horizontal overflow, including the empty history state and interaction with the crew selector.
