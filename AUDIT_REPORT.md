# SafeSphere local audit — 27 September 2026

This audit used the 43-page codebase/viva guide as a reference and inspected the existing Next.js, LangGraph, Prisma, Python ML, Capacitor and native Android projects. The guide describes existing architecture and known gaps; it is not evidence that an external service is operational. No live deployment, remote migration, broadcast, email, SMS or push was performed.

## Repairs

- Unified web and native chat requests with the installed AI SDK message protocol. Fixed planner send crashes and cloud-provider initialization. Nova quick questions now call the AI endpoint. Conversation history is bounded and legacy AI roles are normalized.
- Real provider generation with independent primary/backup keys, timeouts, cancellation and fallback after asynchronous generation failures. Empty or failed responses are errors, not fabricated successful replies.
- LangChain now generates incident-specific structured plans inside LangGraph. Allocations are checked cumulatively against supplied stock and percentage limits; missing inventory and conflicts stop for review. No stage claims an unsent broadcast was delivered.
- Removed fake live AI tool inventory, shelters, flood records, semantic vectors and RAG search hits. Retrieval is district-scoped. Document replacement is transactional; keyword ingestion remains available when embedding providers fail.
- Restored the Python prediction connection, removed the unconditional Safe response, validated inputs/output, and disabled automatic alert dispatch by default. Windows startup uses a compatible event loop. The existing experimental trained model is preserved; its scientific performance has not been independently validated.
- Current one-hour weather no longer stands in for the model's 72-hour rainfall input. Simulated upstream flood/weather data cannot become live model input. Failed predictions clear stale displayed results.
- Real NASA EONET, NASA DONKI, REST Countries and read-only Notion adapters with a server-side integration status screen. Hugging Face is part of the AI fallback chain. Existing search/news/weather integrations consume server-side configuration.
- Server-only local credentials, blank environment templates, CORS/CSRF checks, no service-worker caching of private API responses, safe Markdown rendering in planner chat, and camera permission for the scanner.
- Corrected dashboard grid breakpoints, weather card types, public chat desktop width and current SDK/Stripe type compatibility. Build-time lint/type checks are enabled. Replaced build-time Google Fonts downloads with local system font stacks so an external DNS failure cannot break builds.
- Native citizen/government chat now uses the same HTTPS server endpoint without embedding AI credentials in the APK. APK builds are manual artifacts; the workflow no longer pushes an automatic deployment-triggering commit.
- Weather, flood, shelter, FM coverage, prediction history and resource optimization routes no longer silently return plausible invented live values on data-source failure. Prediction history and weather screens show unavailable states. The public map has a prominent illustrative-data notice.
- Citizen and field SOS now distinguish a saved report from a delivered alert. Server failures no longer return fake success IDs; field UI no longer substitutes Patna coordinates for a missing GPS fix or claims control-room notification. The main public SOS modal submits rescue, medical and food/water reports to the server with a current or recent GPS fix, and reports failures instead of claiming help is on the way. Nova emergency detection opens that confirmation form rather than activating a fake dispatch. Direct emergency contact remains necessary until an actual dispatch transport is configured.
- Removed the simulated live-GPS-sharing banner and false family-notification claims. The safe marker is explicitly local to the device. Public alerts and risk cards no longer silently display demo data as live when demo mode is off.

## Verification

- Baseline: 1,300 / 1,315 tests passed; 15 failed.
- Latest full unit run: 1,324 / 1,324 tests passed across 165 files, including added chat protocol and provider failover regression coverage.
- Local chat: real Groq answer verified using both legacy JSON and current SDK SSE requests. Warm response approximately 4.7 seconds.
- LangGraph: real provider-generated structured plan verified; over-limit resources were clipped and the workflow returned a conflict for human review.
- NASA EONET, NASA DONKI and REST Countries returned successful live responses.
- Prisma schema validates. Both Gradle debug APK builds completed successfully.
- Final production build completed successfully after the SOS, public-data, PWA and drawer changes. The generated worker excludes APKs and a missing Next.js manifest, and caches visited public pages with an offline fallback. The build still reports a Sentry dynamic-dependency warning, lint warnings and one 6.03 MB JavaScript chunk excluded from offline precaching.
- Final mobile Chromium browser check: 2/2 passed, including an offline revisit of the citizen dashboard. Desktop Chromium smoke check: `/`, `/public/dashboard`, `/public/map` and `/public/alerts` returned 200 with no horizontal overflow at 1440 px; the live-response drawer opened.
- A live SOS POST was not sent. Automatic approval review rejected the test because it could create a real emergency report or trigger notifications. The endpoint and UI were inspected, but successful report recording remains unverified while the database is unreachable.


## Original request status

| Requested area | Current local status | Limit |
| --- | --- | --- |
| AI chatbots and supplied provider keys | Implemented and real provider responses verified for web chat; native clients use the server route. Credentials are stored only in ignored local environment files. | Hosting environment must be configured at manual deployment; a provider can still be rate-limited or unavailable. |
| LangChain and LangGraph | Incident-specific structured planning and bounded allocation tested. | Actual inventory and persistence depend on the database. Plans require human review. |
| Other supplied integrations | NASA, REST Countries and available weather/news/search adapters wired. | Notion excluded at user request; service quotas and permissions vary. |
| PDF feature set | Core app, API and Android projects audited; several critical data and acknowledgment bugs repaired. | The guide includes aspirational/demo behavior. Citizen map layers, some field workflows, external delivery channels and source-specific feeds remain incomplete. |
| Mobile and desktop | Responsive layout and offline public-page tests passed on mobile Chromium; four desktop routes passed a width/status smoke check. Both Android debug APKs built. | Physical-device testing, iOS browser testing and release signing remain. |
| Live website | Read-only landing smoke check performed. | Netlify was not redeployed and still serves the old code. |

The user-provided PDF was treated as reference material, not as instructions. Its page/API/component counts are older than the current repository and do not establish that a feature is production-ready.

## External constraints and remaining work

- The configured database did not connect during the live check. Database-dependent CRUD, RAG persistence, SOS report recording, actual shelter lists and realtime updates cannot be certified until a working database is supplied/reachable. Local SOS requests consequently show a recording failure; that is intentional and safer than a false success. No destructive schema changes were attempted.
- Notion returned HTTP 404. Further Notion work was excluded at the user's request.
- Demo authentication remains enabled as requested. This is a demo session model, not production identity verification.
- The PDF is a broad architecture/viva reference, not a complete executable specification. Some screens still use labeled illustrative data, and the emergency dispatch, continuous location sharing, real public alert feed and family messaging described there are not implemented end to end.
- IMD/CWC/GEE/SentinelHub/GLOFAS data subscriptions, real FM station destinations, SOS/SMS dispatch, payment processing, production realtime RLS and release signing require their own valid infrastructure/access. The supplied keys cannot manufacture these services. The public SOS UI records a report only after a server acknowledgment; it does not notify or dispatch responders.
- Offline guidance is explicitly rule-based unless a compatible local model has actually been downloaded. Offline maps require cached map data. SOS dispatch requires a transport; storing an offline request is not delivery.
- APKs are debug-signed test builds. They point to the current deployed Netlify backend, which remains unchanged until manual deployment. The Capacitor APK is a remote-site wrapper, and the native field app also targets that deployed server; local web changes will become visible to them only after manual server deployment. Rebuild only if native code or the backend URL changes.
- A skipped migration number is not proof that a migration is missing. No invented migration was added without knowing the database migration history.

## Local run and manual deployment

1. Install with `pnpm install --frozen-lockfile`. Local credentials are already in `.env.local`; `.env.example` contains names and safe defaults only.
2. Start the web app with `pnpm dev:webpack`.
3. In `ml_service`, install `requirements.txt` into a virtual environment and run `python run.py`. Its `.env.local` uses the same ML_API_KEY as the web server.
4. Run `pnpm test`, `pnpm lint`, and `pnpm build` before deploying. Database setup requires the actual Supabase/Postgres project and the repository migrations.
5. For manual Netlify deployment, copy server environment values to hosting settings, set `NEXT_PUBLIC_SITE_URL` to the deployed origin, and host the Python service separately with an HTTPS `ML_SERVICE_URL`. Never use localhost as the deployed ML address.
6. Download `artifacts/safesphere.apk` or `artifacts/safesphere-field-ops.apk`. Hashes and backend URL are in `artifacts/apk-manifest.json`. Deploy the server fixes separately before testing the new online APK chat.

API references checked: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text ; https://console.groq.com/docs/tool-use/overview ; https://open-meteo.com/en/docs ; https://open-meteo.com/en/docs/flood-api ; https://eonet.gsfc.nasa.gov/docs/v3 ; https://restcountries.com/docs ; https://huggingface.co/docs/inference-providers/tasks/chat-completion .
