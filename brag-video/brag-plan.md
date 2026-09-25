# Brag Plan: SafeSphere — AI-Powered Disaster Response Platform

## What is this app?
SafeSphere is an Emergency Operations Center that fuses live flood forecasts (XGBoost ML), a real-time incident map (MapLibre + PostGIS), AI multi-agent triage and evacuation planning (LangChain/LangGraph), and multi-channel alert broadcasting (SMS, push, WhatsApp, FM radio) into one platform — with a citizen app and a field-responder mobile app, demoed on Patna, Bihar.

## The angle
**The video is not a product ad — it is an emergency broadcast.** We drop the viewer straight into a live EOC dispatch feed the way an operator would see it: flood risk spikes on the map, the AI plans the evacuation, the alert goes out on every channel at once, and it lands as a push notification on a field responder's phone. The urgency comes from the product's own copy and systems, never from hype. No "streamline your workflow" anywhere — this is "EVACUATE NOW: FLOOD in PATNA. Go to shelter. Call 1070."

## Hook (first 2-3 seconds)
A dark satellite-feed frame with a radar sweep. Mono, machine-stamped type:
`FLOOD RISK — PATNA (GANGA)` with the status badge escalating WATCH → WARNING and a red flood polygon pulsing on the map. A quiet warning tone. Something is happening right now, and an operator (or an AI) has to act.

## Key moments (the middle)
- **The command center wakes up.** EOC headline "EVERY SECOND SAVES LIVES." KPI cards arrive one by one: `08 Active Alerts`, `286 Rescue Teams`, `974 Shelters`. The live activity feed ticks: "Flood risk elevated to WARNING — Patna (Ganga)."
- **AI triage.** The LangGraph agent chain runs: Flood Analyst → Shelter Manager → Evacuation Planner. A prediction card lands: `AI PREDICTION — 96% confidence`. A plan line types out: "Evacuate Ganga floodplain → Danapur shelter. 6 boats + 3 buses."
- **One alert, nine channels.** Channel capsules fire in sequence across two rows — FM Radio, SMS, WhatsApp, Web Push, TV, Loudspeaker, Cell Broadcast, IVRS Call, Sirens — then a phone mockup slides in and receives the push notification: `🔴 EVACUATE NOW — FLOOD in PATNA. Go to shelter. Call 1070.`

## Outro / punchline
The field responder's phone: a task card `Evacuate 240 residents · Ganga floodplain` flips to DONE with a green check, `26 rescued` chip pops. Hard cut to the logo slam: **SAFESPHERE** with "No citizen left unwarned."

## User flow worth showing
Detect → Triage → Broadcast → On the ground:
1. **Entry:** flood risk spikes on the map (scene 1) and the EOC lights up (scene 2).
2. **Key action:** the AI agents run the triage and produce a plan (scene 3); the alert engine dispatches across channels (scene 4).
3. **Result:** the notification lands on a field responder's mobile device and a task is completed (scene 5).

This is the real product loop — not landing-page sections. Centerpiece scenes recreate the EOC dashboard, AI planner output, and mobile push UI.

## Tone
- Preset: `cinematic`
- Creative direction: **urgent emergency-ops broadcast** (user-provided)
- Interpretation: Trailer-scale pacing but with total credibility — big mono type, dark navy FEMA-grade surfaces, severity colors doing the talking, dramatic reveals at the strongest music cues. Restrained, professional, no cheese. SFX are sparse and high-impact (alerts, not bleeps).

## Format: landscape — 1920×1080
## Duration: ~20 seconds (scenes sum to 19.8s)

## Visual identity (from the project)
- Background: `#0a0f1a` → `#0b1f3a` deep navy (roadmap bg-primary / brand-navy); panel `#0b1120`
- Accent: blue `#2563eb` / `#3b82f6`, orange `#f97316`
- Severity: SAFE `#10b981` · WATCH `#f59e0b` · WARNING `#f97316` · CRITICAL `#ef4444`
- Text: `#f1f5f9` primary, `#94a3b8` secondary, `#c9d6ec` on-navy
- Display font: Poppins (project's `--font-display`)
- Body font: Inter (project's `--font-sans`)
- Data/mono font: JetBrains Mono (project's `--font-mono`) — timestamps, coordinates, alert text
- Strongest visual element: the dark live-feed card with pulsing severity rings + incident dots; severity badges; EVACUATE push notification

## Share copy (draft)
SafeSphere. When the waters rise, every minute counts — AI predicts the flood, plans the evacuation, and alerts every citizen before it arrives.

## Audio direction
- Role: cinematic support — music provides structure and momentum; SFX carry the urgency
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady + clean, the cinematic/polished pick), ~110 BPM
- Music treatment: fade in ~0.3s, sit at 0.30 volume under the action, hold through the logo
- Music cue guidance: preset read — `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.{md,json}`; strong cues at **9.29s, 13.11s, 17.47s** (target AI prediction reveal, push-notification arrival, logo slam respectively); beat grid in the 4.4–6.6s window for the sequential KPI cards (snap to every-other-beat for label readability)
- Audio-reactive treatment: subtle — flood-polygon glow and card presence breathe with RMS; no waveforms/equalizers
- SFX posture: sparse, professional, high-impact — radar/warning tone in the hook, one announcement hit on the AI reveal, a phone notification bing on push arrival, deep bell on the logo slam
- Audio-coupled moments: sequential KPI cards (beat-grid), typed plan line (key ticks optional), push notification arrival (bing), logo slam (bell)
- Restraint rule: no cartoonish or musical-silly sounds; the video must sound like an EOC, not a slot machine

## Storyboard

Reading-time floors respected: every full line gets its settlement time (short label ≥0.8s, sentence ~0.3s/word).

### Scene 1 — Incident Detected — 2.6s
Dark navy map feed. Radar sweep crosses a flood polygon that pulses from WATCH to WARNING. Mono machine text stamps in: `FLOOD RISK — PATNA (GANGA)`. A severity badge flips amber→orange. `LIVE FEED` corner tag, mono timestamp ticking.
Sequential/interaction: yes — status badge escalates WATCH → WARNING as the polygon glows hotter.
Audio intent: immediate tension. A low warning tone and a soft radar-sweep riser.
Audio-coupled idea: the escalation (badge flip + polygon glow) lands on a warning-tone tick; sweep loop is quiet.
Music: low entrance, barely present. Mood: tense.
Transition mood: hard → Scene 2 (cut on the music's first strong beat window).

### Scene 2 — Command Center — 4.6s
The EOC wakes up. Headline slams in: **EVERY SECOND SAVES LIVES.** Beneath it a recreation of the dashboard: 3 KPI cards arrive one by one (`08 Active Alerts` · `286 Rescue Teams` · `974 Shelters`), each with a small severity ring. A live activity feed row ticks: "Flood risk elevated to WARNING — Patna (Ganga)".
Sequential/interaction: yes — 3 KPI cards stagger in on the beat grid (every-other-beat for label reading), then the feed row types in.
Audio intent: controlled escalation — steady, building.
Audio-coupled idea: each KPI card gets a soft card/drop accent; the feed row types with light key ticks.
Music: settles into the beat pulse. Mood: building momentum.
Transition mood: clean wipe → Scene 3.

### Scene 3 — AI Triage — 4.0s
Agent chain panel: `Flood Analyst` → `Shelter Manager` → `Evacuation Planner` light up in sequence with a thin connection line. Prediction card lands hard: `AI PREDICTION — 96% CONFIDENCE` (locked to the 9.29s strong cue). A plan line types out: "Evacuate Ganga floodplain → Danapur shelter · 6 boats + 3 buses."
Sequential/interaction: yes — 3 agent nodes run in order, then the plan line types.
Audio intent: the "mind of the system" moment — quiet focus, then impact.
Audio-coupled idea: prediction card lands on one deep soft-impact hit; plan line types with subtle key ticks.
Music: holds steady, slight swell into the card. Mood: intellect meets urgency.
Transition mood: hard → Scene 4.

### Scene 4 — One Alert, Nine Channels — 4.4s
Title line: **ONE ALERT. NINE CHANNELS.** Channel capsules fire in sequence across two rows — `FM Radio` · `SMS` · `WhatsApp` · `Web Push` · `TV` / `Loudspeaker` · `Cell Broadcast` · `IVRS Call` · `Sirens` — each snapping on. A phone mockup with the citizen-app chrome slides in and the push notification arrives (locked to the 13.11s strong cue): `🔴 EVACUATE NOW — FLOOD in PATNA · Go to shelter · Call 1070`.
Sequential/interaction: yes — 9 channels snap in on the beat grid (first six on consecutive beats, last three cascade on the 15.29s beat), notification slides down with a bing.
Audio intent: broadcast urgency — each channel snap is a crisp sub-hit, the notification bing is the payoff.
Audio-coupled idea: channel capsules on consecutive beats (accents are non-text, so every beat is fine); notification = bing.
Music: energy up. Mood: all channels firing.
Transition mood: dramatic wipe → Scene 5.

### Scene 5 — Field Responder + Outro — 4.2s
Phone mockup shows the field-responder task list: `Evacuate 240 residents · Ganga floodplain` flips to DONE with a green check; a `26 rescued` chip pops. Hard cut to full-bleed logo: **SAFESPHERE** with **No citizen left unwarned.** (logo slam locked to the 17.47s strong cue).
Sequential/interaction: yes — task completes (check stroke), status chip pops, then the logo slams.
Audio intent: resolution — warm success tick on the check, then the big cinematic bell on the logo.
Audio-coupled idea: check = crisp success accent; logo slam = deep bell; music holds through the fade.
Music: swells into the logo, holds, fades with the frame. Mood: resolved and confident.
Transition: none — end card.

**Music mood for this video:** cinematic, restrained, building to a resolve at the logo.
**Audio summary:** One steady dark bed from 0s to 20s; sparse, high-impact SFX — warning tone in the hook, soft impact on the AI reveal, notification bing, success tick, and a deep bell on the logo — so the video sounds like an operations center, not a slot machine.