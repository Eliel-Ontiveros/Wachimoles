# Trauma Team: your first RAG with DeepSeek

RAG means Retrieval-Augmented Generation: search your own resources first, then ask a language model to explain the retrieved evidence. It does not train or fine-tune DeepSeek. Changing the resource index changes what evidence the assistant can access.

## What this implementation does

```mermaid
flowchart LR
  A[NASA / CSA HTML pages] --> B[Extract readable text]
  B --> C[350-word passages, 70-word overlap]
  C --> D[Versioned local corpus]
  E[App: question + selected environment + optional body zone] --> F[Backend: authenticated BM25 retrieval]
  D --> F
  F --> G[Up to 4 relevant passages]
  G --> H[DeepSeek: explain using supplied evidence]
  H --> I[Validate source IDs]
  I --> J[App: explanation + original passages + source links]
```

There are two separate workflows:

1. **Ingestion**, run when sources change: download the curated pages, remove navigation and social content, split the text into overlapping passages, record URLs, retrieval timestamps and SHA-256 hashes, and save `Wachimoles_Backend/src/rag/corpus.json`.
2. **Question answering**, run for every question: search the stored passages and optionally ask DeepSeek to produce a short explanation. Free-text questions retain environment/body-zone reranking. Structured muscle reports require a matching body region before ranking by condition and present symptoms. Every generated statement must reference a retrieved passage ID.

The app calls NestJS. The DeepSeek key stays in NestJS. Supabase continues to store existing app records; this first RAG does not require database changes.

The committed corpus contains five original source snapshots and twelve reviewed evidence summaries (17 sources, 23 passages). You can try retrieval without downloading them again or creating a DeepSeek account.

## Source catalog and its limits

The upstream [challenge page](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) did not respond during implementation. The five candidate resource links were discovered through the [HackAthlone local-event challenge page](https://hackathlone.com/challenges/health-monitoring-software). Their content was downloaded directly from NASA and CSA. Confirm the catalog against the official Resources tab when it becomes accessible.

- [5 Hazards of Human Spaceflight — NASA](https://www.nasa.gov/hrp/hazards/)
- [Risks of Human Spaceflight — NASA](https://www.nasa.gov/hrp/risks/)
- [Ongoing HRP Research in Space — NASA](https://www.nasa.gov/hrp/ongoing-hrp-research/)
- [Monitoring Radiation for Astronaut Health — CSA](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp)
- [Why Do We Conduct Science Experiments in Space? — CSA](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp)

The original pages remain indexed. Twelve additional sources are represented by **original curator-authored evidence summaries**, not complete papers or verbatim extracts. Each summary includes the population/environment, reviewed sections, findings and applicability limits together in one passage. Source links point to the original publications; `contentKind: reviewed_summary` explicitly identifies the indexed representation. `sourceLicense` describes the referenced document, not a claim that its full text has been redistributed. Linked articles, videos, PDFs, images and datasets are not automatically followed.

| Added source ID | Coverage |
|---|---|
| chang-lumbar-2016 | Lumbar MRI, paraspinal muscle and back-discomfort limits |
| nasa-shoulder-2025 | Shoulder mechanics and Earth-based EVA training; excludes treatment guidance |
| english-sprint-2020 | Exercise, strength, endurance and residual deconditioning |
| gabel-bone-recovery-2022 | Site-specific bone recovery after flight |
| doherty-wearables-2024 | Device/outcome-specific validation; sleep and step limitations |
| leeb-oximetry-2024 | Fingertip SpO2 validation and limits of transfer to wrist sensors |
| hickey-stress-2021 | HR/HRV, physiological signals and proprietary stress-score limits |
| flynn-evans-circadian-2016 | Sleep timing, modeled alignment and fatigue interpretation limits |
| richter-partial-gravity-2017 | Partial-gravity evidence, analogs and chronic planetary uncertainty |
| stahn-temperature-2017 | Temperature measurement site, method and exercise context |
| tays-sensorimotor-2021 | Balance, mobility and task-specific readaptation |
| george-artemis-radiation-2024 | Uncrewed dosimetry, shielding and exposure-data requirements |

The catalog records original titles, authors, years, identifiers, source URLs, review dates and source reuse notices. Correction/retraction checks remain incomplete and are explicitly recorded. The evidence is educational; it does not validate Active 2 or support individual diagnosis, medication advice or duty clearance. Review date: November 14, 2026.

## 1. Start the backend in search-only mode

Use Node.js 20 or later. In a terminal:

```powershell
cd Wachimoles_Backend
npm ci
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead of copying over it. Fill the existing Supabase, dashboard user, token and web-password settings. The backend validates those settings even though retrieval itself does not query Supabase. Keep:

```dotenv
RAG_GENERATION_ENABLED=false
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
```

Then:

```powershell
npm run start:dev
```

The corpus is imported at build time and included in the compiled backend. Local search works without external AI calls. An empty corpus produces an explicit 503 instead of an invented answer.

## 2. Open the assistant in the app

In a second terminal:

```powershell
cd TraumaTeamMovil
npm ci
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead. Set:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000
EXPO_PUBLIC_DASHBOARD_API_TOKEN=the-same-token-used-by-the-backend
```

A physical phone must reach your computer's LAN address; `localhost` on the phone means the phone itself. Expo web can use `http://localhost:3000`; add its actual browser origin to backend `CORS_ORIGINS`. Use HTTPS outside development.

```powershell
npm start
```

Open the side menu and select **Space Health Assistant**. Start with the built-in English example questions. In search-only mode the screen displays **Retrieved passages**, excerpts, source links and the environment used for the request. No AI-generated answer is claimed.

## 3. Enable DeepSeek generation

### Web muscle reports

The separate Vite web dashboard also calls the existing assistant endpoint. Configure `TraumaTeamWeb/.env` using its `.env.example`, select an active muscle report and press **Review symptoms against documents** in the muscle detail panel. See the [web setup and response behavior](../TraumaTeamWeb/TraumaTeamWeb/README.md).

The web request separates the question from an optional validated `muscleReport` object. Existing mobile/free-text requests remain valid without this object. The environment comes from the selected astronaut's saved context, not a second selector. No other health data or photos are attached; polling never triggers generation.

```json
{
  "question": "What can the indexed research explain about this reported muscle problem?",
  "environment": "spacecraft",
  "bodyZone": "Lower back",
  "muscleReport": {
    "conditionName": "Pain",
    "painIntensity": 5,
    "swelling": false,
    "functionalLimitation": false,
    "notes": "",
    "recordedAtIso": "2026-11-15T10:00:00Z"
  }
}
```

The report requires a nonblank condition (maximum 180 characters), integer pain intensity from 0 to 10, boolean symptom flags, and notes up to 700 characters. The ISO timestamp is optional. Unknown nested fields and invalid values are rejected with HTTP 400. Without a usable body zone, a muscle report returns insufficient evidence.

Search excludes instructions, timestamps and negative symptom flags. Narrow anatomical aliases connect deltoid/shoulder and lower-back/lumbar (including Spanish shoulder/lower-back labels); other regions abstain until their evidence coverage and whole-zone aliases are reviewed. Arbitrary token overlaps such as “back” in “Back of leg” or “upper” in “Upper arm” never select another region's evidence. Region matches are mandatory and strongly weighted; only present symptoms boost ranking. Notes are limited to 200 characters at low weight for retrieval, but all 700 bounded characters reach the generator. No region match means `insufficient_evidence` and no provider call, rather than borrowing research from another body region.

The prompt asks for relevant findings followed by their limitations, keeps reported facts distinct from research, and makes swelling/wearable cautions conditional. It preserves population and environment limits and abstains when no relevant explanation is supported. These controls reduce irrelevant answers; citation-ID validation still does not prove semantic entailment or medical correctness.

### Backend generation settings

Create an API key in your own [DeepSeek Platform account](https://platform.deepseek.com/). API access and balance are separate from using the consumer chat interface; check the account's current access and billing before enabling calls. Never paste the key into the mobile app, a public Expo variable, or a Git commit.

Edit only `Wachimoles_Backend/.env`:

```dotenv
RAG_GENERATION_ENABLED=true
DEEPSEEK_API_KEY=your-own-api-key
DEEPSEEK_MODEL=deepseek-flash
```

Restart the backend and reopen the assistant screen. Submit a question again. The expected mode is **Evidence-based explanation**, with references such as `[1]` that correspond to the passage cards below.

The integration calls `POST https://api.deepseek.com/chat/completions` using [DeepSeek's documented API](https://api-docs.deepseek.com/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/). The model name is configurable because model availability changes. No OpenAI key, SDK or separate embedding service is required.

When generation is enabled, a question sends its text, selected environment, optional body zone, and retrieved passages to DeepSeek. The mobile question screen does not automatically attach wearable readings, saved questionnaires, body observations or photos. The web muscle assessment includes a separate structured report as described above. This version makes independent requests and does not retain chat history in the application.

## 4. Verify the flow directly

In PowerShell, enter the prototype dashboard token locally:

```powershell
$ragHeaders = @{ Authorization = 'Bearer YOUR_DASHBOARD_TOKEN' }
Invoke-RestMethod -Uri 'http://localhost:3000/dashboard/assistant/status' -Headers $ragHeaders

$ragQuestion = @{
  question = 'How does space radiation affect astronauts?'
  environment = 'mars'
  bodyZone = ''
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3000/dashboard/assistant/ask' `
  -Method Post -Headers $ragHeaders -ContentType 'application/json' -Body $ragQuestion
```

The authenticated status endpoint reports indexed sources/passages and whether generation is configured. Configuration readiness does not prove that the API key is valid or has credit.

Response modes:

- `generated`: DeepSeek returned an explanation with valid retrieved source IDs.
- `evidence_only`: generation is disabled or not fully configured; real search passages are returned.
- `insufficient_evidence`: no relevant passages were found, or the model explicitly abstained.
- `generation_unavailable`: timeout, provider error, empty/truncated output or invalid citations; real search passages remain available.

The server waits up to 30 seconds for DeepSeek; the app waits up to 40 seconds for the request. No automatic paid retries are performed.

## 5. Update or extend the knowledge base

Edit `Wachimoles_Backend/knowledge/sources.json`, then:

```powershell
cd Wachimoles_Backend
npm run rag:ingest
npm test
npm run build
npm run start:prod
```

Stop any older backend instance first. In watch mode, restart after updating the corpus. Redeploy the rebuilt backend to update a deployed index.

The downloader identifies itself to source servers, accepts only curated HTTPS agency hosts, checks redirect destinations, and requires readable HTML. It replaces the corpus only after every listed source downloads and extracts successfully. If a source fails, the previous corpus stays intact. Inspect the generated text before committing it. Timestamps are stored in UTC.

For an offline rebuild using the existing five snapshots and the local reviewed summaries:

```sh
npm run rag:ingest -- --offline
```

Offline mode verifies baseline manifest identity, chunk overlap, word counts and SHA-256 content hashes before reuse; it preserves original retrieval dates. Changed or missing remote sources require online ingestion. Local summaries are confined to `knowledge/reviewed/*.txt`, validated, hashed and indexed anew. Their `retrievedAt` is the local indexing time; `reviewedAt` is the evidence-review date. This route does not download publisher HTML or parse PDFs. The agency downloader's host restriction remains unchanged; web/mobile citation-link validators now also accept the exact selected PMC, Springer and Frontiers hosts.

To add another agency host, update the downloader and mobile source-link allowlists after reviewing the source. To add a PDF, implement PDF-to-text extraction and preserve document/page metadata first; do not pass PDF bytes to this HTML extractor. Review each source's reuse terms before redistributing its content.

## Why this version has no embeddings

RAG needs retrieval, but retrieval does not require a vector database. This corpus is a few thousand English words, so BM25 word matching is a useful first implementation: it is local, transparent, inexpensive and easy to inspect.

Its limits matter: synonyms, misspellings and Spanish questions may retrieve poorly; a matching passage does not establish that it answers the question. The selected environment reranks results but does not supply a missing match. Retrieval scores are not medical confidence values.

If evaluation shows poor recall, the next step is semantic or hybrid retrieval:

1. Use a separate embedding model to turn each passage into a numeric vector.
2. Store vectors and provenance in Supabase with pgvector.
3. Embed each question using the same model and dimensions.
4. Retrieve nearby vectors, optionally combine with BM25, and pass the passages to the same DeepSeek generation step.

DeepSeek is the generator in this design. An embedding provider or local embedding model would be a separate choice. Keep that change behind the retrieval function so the app contract stays stable.

## Evaluation before expanding to symptom assistance

Start with a small reviewed set of questions and expected source passages. Include radiation, bone/muscle changes, sleep, isolation, questions absent from the corpus, requests for drug doses, and attempts to make the assistant ignore its evidence. Check retrieval separately from answer quality.

The automated tests cover retrieval on the source snapshots, unknown-topic abstention, request validation, authentication, evidence-only operation, provider failures and malformed/fabricated citation IDs. DeepSeek responses in those tests are mocked; a real key and one real question are needed to verify live generation. A successful citation check does not establish that the cited passage actually supports a generated medical statement. Human review is still needed.

Before expanding to personalized symptom assistance, curate appropriate clinical references and review the behavior with qualified specialists. Add health context deliberately with units, measurement timestamps and freshness rules. Never convert an old wearable reading into a claim about the current condition.

The existing shared dashboard token is prototype access, and Expo public variables are extractable. Before public deployment, replace shared client access with per-user authentication and add server-side rate/cost limits. Do not expose the DeepSeek key or Supabase service-role key.

## Code map

- `Wachimoles_Backend/scripts/ingest-rag.mjs`: download, extraction, chunking and provenance.
- `Wachimoles_Backend/knowledge/sources.json`: curated source catalog.
- `Wachimoles_Backend/src/rag/corpus.json`: versioned source snapshots and passages.
- `Wachimoles_Backend/src/rag/retrieval.ts`: BM25 ranking and optional mandatory region gate.
- `Wachimoles_Backend/src/rag/muscle-retrieval.ts`: structured-report search terms and conservative region aliases.
- `Wachimoles_Backend/src/rag/rag.service.ts`: prompt, DeepSeek call, citation validation and fallback.
- `Wachimoles_Backend/src/rag/rag.controller.ts`: authenticated HTTP endpoints.
- `TraumaTeamMovil/src/services/assistant-api.ts`: mobile HTTP contract and source validation.
- `TraumaTeamMovil/src/app/assistant.tsx`: assistant screen.
- `TraumaTeamWeb/TraumaTeamWeb/src/services/assistant-api.ts`: authenticated web client and response validation.
- `TraumaTeamWeb/TraumaTeamWeb/src/services/muscle-assessment.ts`: selected muscle report to RAG request.
- `TraumaTeamWeb/TraumaTeamWeb/src/components/MuscleRagAssessment.tsx`: web assessment, citations and request states.
