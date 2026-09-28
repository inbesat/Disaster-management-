# Offline SOS — Scope Lock (Phase 0)

> FM-pitch style claim: **"Queued offline, relayed by any channel, including the phone's own satellite SOS."**
> The OS satellite step is a **guided handoff, never an integrated send**. This keeps judges
> from asking for a live demo of something Apple/Google forbid.

## What we do NOT claim

- We do **not** trigger Apple's Emergency SOS via Satellite. No public API exists for third parties.
- We do **not** transmit via satellite radio from the browser. Browsers cannot touch satellite radios, ever.
- We do **not** send via Android satellite. Satellite send is carrier-gated (carrier + capable device + plan).
- Any "satellite" box in a diagram means: (a) guided handoff screen telling the user to use the
  phone's own OS satellite flow with our payload pre-displayed, or (b) BLE to a paired commercial
  satellite communicator (Zoleo / inReach), or (c) a stubbed `MockSatelliteTransport` behind the
  `SosTransport` contract until a carrier/provider contract exists.

## Tiered outage model (floods fail in this order)

| Condition | Internet | SMS | Voice |
|---|---|---|---|
| Normal | yes | yes | yes |
| Tower up, backhaul cut | no | yes | yes |
| Power down, tower on battery | no | yes | no |
| Tower down (flooded base station) | no | no | no |
| Total isolation | no | no | no |

Most real flood response is rows 2–3. SMS rides the signaling channel, not the data channel —
tower-up-but-backhaul-cut is the most common disaster failure mode and SMS survives it.

## Transmission ladder (best → worst, never drop the signal)

1. `api` — POST `/api/sos` (public) or `/api/field/sos` (responder). Best fidelity.
2. `sms` — `SmsManager` (native) / `sms:` deep link (PWA). Survives data-dead + 2G-alive.
3. `wifi_direct` — WiFi Direct peer exchange, ~50–200 m. Local mesh only, labelled as such.
4. `ble_mesh` — BLE advertise/scan relay via a nearby phone with signal. Dedupe by SOS id.
5. `ble_satellite` — BLE to a paired satellite communicator (hardware required, GATT docs vendor-gated).
6. `satellite_guided` — instructions-only handoff to the OS satellite flow. No RF touched by us.

Every rung reports honestly which one carried the SOS. A false "sent" is worse than a visible "pending".

## Delivery lifecycle (single source of truth)

```
captured → queued → sent_api | sent_sms | sent_wifi_direct | sent_ble_mesh
         | sent_ble_satellite | satellite_guided → delivered | failed
```

- `captured`: GPS fix + payload written locally. Nothing has left the device.
- `queued`: accepted into the outbox (Dexie / Room / `OfflineSyncQueue`). Still on-device.
- `sent_*`: handed to a transport. Transport name is recorded, not a generic "sent".
- `satellite_guided`: user was shown the OS handoff screen. We did not transmit.
- `delivered`: server or relay acknowledged receipt.
- `failed`: all applicable rungs exhausted or rejected. Still retryable.

Native `SosEventEntity.status` and server `CrowdsourcedReport` carry this vocabulary.
`transport_channel` / source tags (`sms`, `satellite-feed`, `mesh-relay`) are recorded at ingest,
with the same audit convention as `fm_broadcast_logs`.

## Demo contract (what a judge may verify live)

- Airplane mode ON → SOS → UI says **"queued locally"** (never "sent").
- Airplane mode OFF → outbox drains → UI names the rung (`sent_api`, `sent_sms`, …).
- Two phones, no network → BLE/WiFi-Direct relay → relay phone shows the payload, server dedupes by SOS id.
- Satellite → judge is shown the **guidance screen + simulator toggle** under `/demo`, same convention
  as the FM simulator. No real RF is ever touched in a demo.

## Build order (demo value per effort)

1. Offline SOS queue + auto-flush (PWA + native outbox drain). Fully real today.
2. Compact SOS codec (~60 chars, checksum, QR + copy + SMS surfaces, server decoder).
3. Mesh relay (BLE first, WiFi Direct second — strongest live differentiator).
4. Guided OS satellite handoff (native shell, detection only).
5. Responder-side ingestion (Garmin/inReach/mesh sources into triage, source tags + dedupe).
6. Partnerships (carrier/NDMA Direct-to-Cell, hardware) — docs only until 1–5 prove the pipeline.
