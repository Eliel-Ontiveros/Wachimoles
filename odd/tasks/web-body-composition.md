# Web: body composition cards + muscle-focus layout (TraumaTeamWeb)
Branch feat/web-body-composition (from main 5fd7097). Web only; backend endpoints GET /dashboard/weights and GET /dashboard/body-profile already exist.

## Specs
- S1 User (verbatim): "en lo negro creas las tarjetitas similartes a las de la izquierda,  usa iconos genericos de momento, luego  nos pasan otros."
- S2 User (verbatim): "mi idea es que al picarle a un musculo regrese el campo de la derecha y la parte izquierda se vuelva un carrusel para navegar entre opciones"
- S3 User (verbatim): "Todo esto cabe aclarar que es en el proyecto web"
- S4 Default layout (no muscle selected), per designer image 1: column 1 = current vitals (ECG, vital cards, Flight Log); column 2 = NEW body composition cards; column 3 = 3D body viewer.
- S5 The new cards show the smart-scale metrics from GET /dashboard/weights (latest weighing): weight, BMI, body fat %, lean mass, body water, basal metabolism; same card look as the vital cards (icon box, title, value + unit, range bar where a reference range exists). Generic icons for now. (User choice: "Métricas de la báscula".)
- S6 Selecting a muscle, per designer image 2: column 1 becomes a carousel with two slides, Vitals ↔ Body composition (User choice: "Vitales ↔ Composición corporal"); column 2 = 3D viewer; column 3 = muscle detail panel (returns), with a close button that deselects the muscle and restores S4.
- S7 The "Muscle tracking" panel (Active/History) stays next to the muscle detail, only in column 3 while a muscle is selected (User choice: "Junto al detalle del músculo").
- S8 The 3D viewer must not reload when the layout switches; tablet/mobile stage switcher keeps working.

## Tasks
- T1 S5 — service fetchers (weights, body-profile) + band utils, test-first — done (tests/body-composition.test.ts, src/utils/body-composition.ts, src/utils/gauge.ts, backend-api.ts; 36/36 web tests)
- T2 S1,S5 — BodyCompositionCards component — done (src/components/BodyCompositionCards.tsx + body-composition.css, src/hooks/use-body-composition.ts; tsc + eslint clean; not yet rendered in App)
- T3 S2,S4,S6,S7,S8 — layout switch, carousel, close button — implemented by worker (App.tsx, SideCarousel.tsx, side-carousel.css, index.css); browser verify at 1440 passes S4-S8 (viewer iframe 0 reloads, vitals node kept); fixing tablet (1000px) 'All' viewer collapse/overlap and close-button offset

## Log
- L1 "ahora me gustaria desarrollar el frontend, te mando las propuestas del disenador: [Image#1] en lo negro creas las tarjetitas similartes a las de la izquierda,  usa iconos genericos de momento, luego  nos pasan otros. [Image#2] mi idea es que al picarle a un musculo regrese el campo de la derecha y la parte izquierda se vuelva un carrusel para navegar entre opciones  Todo esto cabe aclarar que es en el proyecto web"
- L3 Verify (Playwright, weights stubbed): desktop pass; tablet 'All' viewer collapsed to 22px and carousel overlapped detail; web app has no backend URL in TraumaTeamWeb/TraumaTeamWeb (Vite env lives one level up) — verified with an in-browser shim.
- L2 Answers: cards = scale metrics; carousel = Vitals ↔ Body composition; Muscle tracking = next to muscle detail.
