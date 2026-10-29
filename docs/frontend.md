# Frontend

Next.js App Router, React, TypeScript, Tailwind 4, shadcn-style Radix Slot/CVA buttons, Radix dialogs, Motion, TanStack Query, Zustand, Recharts, MapLibre GL and deck.gl. GSAP is omitted because no interaction requires another animation engine.

Routes: `/`, `/features`, `/login`, `/register`, `/dashboard`, `/explorer`, `/intelligence`, `/predictions`, `/opportunities`, `/optimization`, `/verification`, `/analyst`, `/reports`, `/notifications`, `/settings`, `/admin`, `/help`. Unknown routes return 404. The admin console lives in the shared web app until independent deployment is justified.

Implemented: district/date filters (date controls charts), table search/sort/pagination, CSV with formula-injection mitigation, saved filters, light/dark themes, responsive sidebar, Ctrl/Cmd+K palette, local read notifications, proportional allocation, SHA-256 hashing and fixed-rule analyst replies. The forecast interval is illustrative, not calibrated. Map overlays use synthetic coordinates with a table alternative.

Only registry status and the optional baseline forecast call real backends. Analytics and KPI deltas are seeds. Auth screens never store/submit credentials. Admin personas change navigation only. Wallet submission and LLM integration are planned. Add user sessions and per-user authorization before exposing server adapters publicly.

Dark surfaces, restrained cyan/mint and violet, thin borders and short interactions define the design system. Heavy chart/map modules load dynamically. Reduced motion disables animation. Focus remains visible and Radix traps dialog focus. Tests cover component semantics, persistence, desktop/mobile flows, axe in both themes, error collection and reduced motion. Manual screen-reader testing and broader browser coverage remain needed before a pilot.
