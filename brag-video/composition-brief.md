# Hyperframes Composition Brief: SafeSphere

## Objective
Create a short launch-style brag video for SafeSphere — AI-Powered Disaster Response Platform.

## Output
- Composition directory: `brag-video/composition/`
- Rendered video: `brag-video/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `E:\Hackathons\disaster management\disaster-response-platform`
- Primary files read: `README.md`, `app/page.tsx`, `app/sections/Hero.tsx`, `app/globals.css`, `styles/tokens.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/(dashboard)/command-center/page.tsx`, `lib/broadcast/rds-encoder.ts`
- Product name: **SafeSphere**
- Tagline / strongest claim: **"Every Second Saves Lives. No Citizen Left Unwarned."** / **"One alert. Nine channels. Zero citizens missed."**
- Key UI or visual moment to recreate: the dark "Discord-meets-FEMA" EOC dashboard (deep navy panels, severity badges, pulsing live-feed rings), and the mobile push notification with the real broadcast copy
- Copy that must appear verbatim:
  - `EVACUATE NOW — FLOOD in PATNA · Go to shelter · Call 1070` (adapted from the real RDS encoder line "EVACUATE NOW: FLOOD in PATNA. Go to shelter. Call 1070")
  - `EVERY SECOND SAVES LIVES.`
  - `No citizen left unwarned.`
  - `AI PREDICTION — 96% confidence`
  - `One alert. Nine channels.`

## Creative Direction
- Tone preset: `cinematic`
- Creative direction: **urgent emergency-ops broadcast** (user-provided)
- Interpretation: Trailer-scale pacing with total credibility — big mono type, dark navy FEMA-grade surfaces, severity colors doing the talking, dramatic reveals at the strongest music cues. Restrained, professional, no cheese. SFX are sparse and high-impact (alerts, not bleeps).
- Angle: The video IS an emergency broadcast — flood risk spikes on the map → the EOC lights up → AI plans the evacuation → the alert goes out on every channel → it lands on a field responder's phone.
- Hook: Satellite/radar feed — "FLOOD RISK — PATNA (GANGA)" with the severity badge escalating WATCH → WARNING and a red flood polygon pulsing.
- Outro / punchline: Full-bleed **SAFESPHERE** lockup with "No citizen left unwarned."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals (no random orbs/unrelated particles)
  - Unrelated visual redesign (use the project's navy/blue/orange/severity palette and mono data aesthetic)

## Visual Identity
- Background: `#0a0f1a` → `#0b1f3a` deep navy (radial, never full-screen linear gradient); panels `#0b1120`/`#0f1d38`
- Text: `#f1f5f9` primary, `#94a3b8` secondary, `#c9d6ec` on-navy
- Accent: blue `#2563eb` / `#3b82f6`, orange `#f97316`
- Severity: SAFE `#10b981` · WATCH `#f59e0b` · WARNING `#f97316` · CRITICAL `#ef4444`
- Grid: faint dot grid (`rgba(255,255,255,0.06)` dots) like the project hero
- Display font: Poppins (project's `--font-display`) — 800 weight headlines
- Body font: Inter (project's `--font-sans`)
- Data/mono font: JetBrains Mono (project's `--font-mono`) — timestamps, coordinates, alert text, badges
- Visual references from the project: severity badges, live-feed card with pulsing rings, KPI stat cards, mono metadata corners

## Storyboard
Use the storyboard in `brag-video/brag-plan.md` as the creative contract.

Scene summary (cumulative):
1. **Incident Detected** [0.0–2.6s] — radar sweep, flood polygon, "FLOOD RISK — PATNA (GANGA)", badge WATCH→WARNING
2. **Command Center** [2.6–7.2s] — headline "EVERY SECOND SAVES LIVES.", 3 KPI cards stagger in, live feed row types
3. **AI Triage** [7.2–11.2s] — agent chain Flood Analyst → Shelter Manager → Evacuation Planner, "AI PREDICTION — 96%", plan line types out
4. **One Alert, Nine Channels** [11.2–15.6s] — channel chips fire, phone slide-in, push notification arrives at 13.11s (strong cue), "Delivered: 12,400 citizens"
5. **Field Responder + Outro** [15.6–20.0s] — task flips DONE, "26 rescued" chip, hard cut to SAFESPHERE logo slam at 17.47s (strong cue), "No citizen left unwarned."

## Audio
- Audio role: cinematic support — music gives structure and momentum; SFX carry the urgency
- Audio arc: tense low entrance → building beat pulse → settle to resolve at the logo
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (117.36s, ~110 BPM, steady+clean)
- Music treatment: start at 0, volume 0.30, hold through the video, gentle fade at the very end (≈19.2–20.0s) via the best Hyperframes-supported automation
- Music cue guidance: bundled preset — `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.{json,md}`. Strong cues to target: **9.29s** (AI prediction card, ±0.15s lock), **13.11s** (push notification arrival, ±0.15s lock), **17.47s** (logo slam, ±0.15s lock). Beat grid: sequential KPI cards snap to 4.39/5.34/6.00 (every-other-beat for label readability, ±0.10s); channel chips snap to 11.46/12.02/12.55.
- Audio-reactive treatment: subtle — flood-polygon glow and the persistent navy radial glow breathe with RMS/bass; sample per-frame at 30fps. No waveforms/equalizers.
- Audio-coupled moments:
  - Scene 2 KPI cards — beat-grid card sequence with drop accents
  - Scene 3 AI prediction card — soft impact landing on the 9.29s strong cue
  - Scene 4 channel chips — crisp sub-clicks on consecutive beats; notification = light notification ping at 13.11s
  - Scene 5 task DONE — light glass clink; logo slam — deep resonant bell at 17.47s
- SFX selection guidance: use `sfx-analysis.md`. Prefer low-HF-risk files: `interface/drop_001–003` for KPI cards, `impact/impactSoft_medium_001` for the AI reveal, `interface/click_003` for channel chips, `impact/impactMetal_light_002` for the notification ping, `impact/impactGlass_light_001` for the task check, `impact/impactBell_heavy_000` for the logo bell. Volume 0.55–0.85, never louder than the mix needs.
- SFX analysis guidance: `skills/brag/assets/sfx/sfx-analysis.md` — prefer low/medium high-frequency-risk sounds; bright sounds isolated and quiet only.
- Exact SFX choice: choose filenames, timestamps, density, and volume to match the implemented animation.
- Audio files: copy music + cues + chosen SFX into `brag-video/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview. Prefer native Hyperframes conventions.

Requirements:
- Show real UI/visual elements from the project (EOC dashboard cards, severity badges, live feed, phone push notification, field task list).
- Keep all text readable in the final render (read every line: labels ≥0.8s settled, sentences ~0.3s/word).
- Keep the video within 15–25 seconds (total 20s).
- Include the music/SFX layer as planned.
- Treat cue metadata as optional timing hints; ignore cues that hurt readability or pacing.
- Major reveals may move toward strong cues within ±0.15s; smaller entrances align to beats within ±0.10s. Use 1–3 strong cue locks total.
- Use SFX to support motion: card drops for KPI cards, one soft impact for the AI reveal, clicks for channel chips, a notification ping for the push, a light clink for the task check, a deep bell for the logo.
- Wire subtle audio-reactive motion (flood polygon glow + bg glow breathing with RMS) using the pre-extracted audio data (per-frame sampling loop).
- Use local assets for audio and fonts.
- Run `hyperframes check` before render — brag's single gate.