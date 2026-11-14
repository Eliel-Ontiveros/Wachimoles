# Trauma Team web dashboard

React, TypeScript and Vite dashboard for wearable data, reported muscle symptoms and document-based assistance. The web client uses the existing NestJS RAG; it has no local diagnostic rules or direct AI-provider integration.

## Run locally

Use Node.js 22.18+ (or a supported newer release). From `TraumaTeamWeb/`:

```bash
npm ci
npm --prefix TraumaTeamWeb ci
cp .env.example .env
```

Edit `.env` without overwriting any existing settings:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_DASHBOARD_API_TOKEN=the-same-DASHBOARD_API_TOKEN-as-the-backend
```

Vite reads environment files from this parent directory (`envDir: '..'`). Restart Vite after changing them. Use HTTPS for a production backend and allow the actual web origin in backend `CORS_ORIGINS`.

```bash
npm run dev
```

Run the configured NestJS backend separately. Its Supabase settings are required to load muscle reports. Basic dashboard credentials alone do not authorize the RAG endpoint; the web app needs the Bearer token. This is the existing shared-token prototype: browser configuration is extractable. Keep `DEEPSEEK_API_KEY` and Supabase service-role credentials exclusively on the backend.

## Review muscle symptoms against documents

1. Select an active muscle report in the 3D viewer or the reported-zone list.
2. In **Document-based assessment**, review the report and selected environment.
3. Press **Review symptoms against documents**. Each press makes one request to `POST /dashboard/assistant/ask`.
4. Read the explanation and numbered references. Expand a source to inspect the retrieved passage, snapshot date and original agency URL.

The request includes the selected muscle name, reported condition, pain intensity, swelling, functional limitation, report timestamp, notes and selected environment. A reported condition is not treated as a confirmed diagnosis. Free-text notes remain verbatim; the English BM25 corpus may have limited recall for Spanish-only notes. Long condition names and notes are bounded to fit the existing 1,500-character question limit.

No wearable measurements, general questionnaires or photos are attached to this request. A report's timestamp is shown so an older record is not presented as a current observation. Switching muscles, modifying a report or resolving it clears its assessment and aborts an in-flight request. Changing the environment also clears the previous result. Requests are manual; dashboard polling never starts paid generation.

The response modes retain their backend meaning:

- `generated`: a document-based explanation with validated source IDs.
- `evidence_only`: generation is disabled or unconfigured; retrieved passages are shown.
- `insufficient_evidence`: the corpus cannot answer the question; no diagnosis is invented.
- `generation_unavailable`: provider failure or invalid generation; retrieved passages remain available.

The client waits up to 40 seconds and supports cancellation. Authentication, index, timeout and response-validation errors have a retry action. Invalid citations and source URLs outside the curated NASA/CSA collection are rejected. Citation validation checks provenance, not whether every claim is medically justified.

The current corpus contains spaceflight research overview pages, not clinical diagnostic references. The UI therefore offers a document-based assessment and preserves the backend's abstention policy. A definitive diagnosis cannot be established from this corpus. Enable optional DeepSeek synthesis only in the backend, following [the RAG setup guide](../../docs/RAG.md).

## Muscle photos

The **Fotos** tab loads the selected zone from `GET /dashboard/body-conditions/:muscleId/images` using the dashboard Bearer token. The backend reads the configured user's private Supabase Storage folder and returns short-lived signed image URLs. The browser never receives the Supabase service-role key.

The gallery refreshes the selected zone every minute and on **Reload photos**. Switching zones cancels pending requests and clears the previous zone's images. Loading, permission, network and broken-image states are distinct from an empty gallery. This works even when a selected zone has photos but no active condition report.

The storage response does not include a capture date or recovery-day number, so the gallery shows photo sequence numbers without inventing dates. These images are displayed for review; they are **not** sent to DeepSeek or used as RAG evidence. Current assistance remains text-only.

## Verification

From `TraumaTeamWeb/`:

```bash
npm test
npm run lint
npm run build
```

Client tests cover symptom payloads, absent/resolved reports, response modes, citation and URL validation, authentication, cancellation propagation and explicit backend failures. The backend's own tests cover retrieval, HTTP validation, provider failures and grounded-generation parsing.
