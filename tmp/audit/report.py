from pathlib import Path
p=Path('lib/retrieval/retrieve.ts');s=p.read_text().replace('  district?: string,\n): Promise<RetrievedDocument[]>','  district?: string,\n  keywordOnly = false,\n): Promise<RetrievedDocument[]>').replace('const embedding = await getEmbedding(query);','const embedding = keywordOnly ? null : await getEmbedding(query);');p.write_text(s)
p=Path('app/api/chat/route.ts');s=p.read_text().replace('retrieveRelevantDocuments(sanitizedQuery, 3, district)','retrieveRelevantDocuments(sanitizedQuery, 3, district, true)');p.write_text(s)
root=Path('.')
print('pages',len(list(root.glob('app/**/page.tsx'))),'API routes',len(list(root.glob('app/api/**/route.ts'))),'components',len(list(root.glob('components/**/*.tsx'))))
Path('AUDIT_REPORT.md').write_text('''# SafeSphere local audit — 26 September 2026

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
- Corrected dashboard grid breakpoints, weather card types, public chat desktop width and current SDK/Stripe type compatibility. Build-time lint/type checks are enabled.
- Native citizen/government chat now uses the same HTTPS server endpoint without embedding AI credentials in the APK. APK builds are manual artifacts; the workflow no longer pushes an automatic deployment-triggering commit.

## Verification

- Baseline: 1,300 / 1,315 tests passed; 15 failed.
- After core repairs: 1,322 / 1,322 tests passed across 164 files, including added chat protocol and provider failover regression coverage.
- Local chat: real Groq answer verified using both legacy JSON and current SDK SSE requests. Warm response approximately 4.7 seconds.
- LangGraph: real provider-generated structured plan verified; over-limit resources were clipped and the workflow returned a conflict for human review.
- NASA EONET, NASA DONKI and REST Countries returned successful live responses.
- Prisma schema validates. Both Gradle debug APK builds completed successfully.
- Production build and browser layout checks are being completed; see subsequent verification updates below.

## External constraints and remaining work

- The configured database did not connect during the live check. Database-dependent CRUD, RAG persistence and realtime updates cannot be certified until a working database is supplied/reachable. No destructive schema changes were attempted.
- Notion connection failed during the live check. The adapter reports failure; database sharing and credentials need verification.
- Demo authentication remains enabled as requested. This is a demo session model, not production identity verification.
- IMD/CWC/GEE/SentinelHub/GLOFAS data subscriptions, real FM station destinations, Twilio delivery, payment processing, production realtime RLS and release signing require their own valid infrastructure/access. The supplied keys cannot manufacture these services.
- Offline guidance is explicitly rule-based unless a compatible local model has actually been downloaded. Offline maps require cached map data. SOS dispatch requires a transport; storing an offline request is not delivery.
- APKs are debug-signed test builds. They point to the current deployed Netlify backend, which remains unchanged until manual deployment.
- A skipped migration number is not proof that a migration is missing. No invented migration was added without knowing the database migration history.

## Local run and manual deployment

1. Install with `pnpm install --frozen-lockfile`. Local credentials are already in `.env.local`; `.env.example` contains names and safe defaults only.
2. Start the web app with `pnpm dev:webpack`.
3. In `ml_service`, install `requirements.txt` into a virtual environment and run `python run.py`. Its `.env.local` uses the same ML_API_KEY as the web server.
4. Run `pnpm test`, `pnpm lint`, and `pnpm build` before deploying. Database setup requires the actual Supabase/Postgres project and the repository migrations.
5. For manual Netlify deployment, copy server environment values to hosting settings, set `NEXT_PUBLIC_SITE_URL` to the deployed origin, and host the Python service separately with an HTTPS `ML_SERVICE_URL`. Never use localhost as the deployed ML address.
6. Download `artifacts/safesphere.apk` or `artifacts/safesphere-field-ops.apk`. Hashes and backend URL are in `artifacts/apk-manifest.json`. Deploy the server fixes separately before testing the new online APK chat.

API references checked: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text ; https://console.groq.com/docs/tool-use/overview ; https://open-meteo.com/en/docs ; https://open-meteo.com/en/docs/flood-api ; https://eonet.gsfc.nasa.gov/docs/v3 ; https://restcountries.com/docs ; https://huggingface.co/docs/inference-providers/tasks/chat-completion .
''')
print('Saved audit findings and local/manual deployment instructions.')
