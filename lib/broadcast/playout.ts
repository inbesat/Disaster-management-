// ---------------------------------------------------------------------
// lib/broadcast/playout.ts — radio-automation (playout system) injection.
//
// How flood audio actually gets on air: a station has no generic "alert
// API". It has a playout / radio-automation system holding the music log,
// clock and ad breaks — Audemat/Axia, RCS Zetta, WideOrbit, ENPS, DAD,
// Rivendell, Sam Broadcaster. To interrupt programming you talk to THAT
// system, not to the transmitter.
//
// Supported injection paths, in preference order:
//   1. Playout REST      — POST an emergency cart into now/next + force-play.
//   2. ENPS-style MOS    — rundown insertion for newsroom-driven stations.
//   3. FTP watch-folder  — legacy automation polls /emergency/ (already
//                          covered by lib/broadcast/strategies/ftp-drop.ts).
//
// This module defines the PlayoutSystem interface + two real adapters:
// AudematRest (Axia-family REST, the most common modern install) and a
// generic MosRundown adapter for ENPS-style newsrooms. The factory picks
// from env so one integration proves the pipeline, then replicates per
// station via station.playoutEndpoint (migration 0035).
// ---------------------------------------------------------------------

import { safeLog } from "@/lib/logger";

export interface PlayoutCart {
  /** CAP <identifier> — becomes the cart cut ID. */
  alertId: string;
  headline: string;
  /** Scrolling text for the studio display / RDS mirror. */
  rdsText: string;
  /** Voiced MP3 bytes. */
  audioBuffer: Buffer;
  /** CAP XML for the automation log. */
  capXml: string;
  /** Force immediate on-air (EVI) vs queue-next (watch). */
  interrupt: boolean;
  /** Minutes the cart stays pinned. */
  durationMinutes: number;
}

export interface PlayoutResult {
  ok: boolean;
  responseCode: number;
  responseBody: string;
  /** Automation-side cut/cart ID for the audit log. */
  cartId?: string;
  error?: string;
}

export interface PlayoutSystem {
  readonly kind: string;
  inject(cart: PlayoutCart, endpoint: string): Promise<PlayoutResult>;
}

function bearerToken(): string {
  return process.env.FM_BROADCAST_TOKEN ?? "demo-fm-broadcast-token";
}

/**
 * Audemat/Axia-family REST adapter. Real installs expose
 * POST {endpoint}/api/v1/emergency with a multipart cart (audio + meta
 * JSON) and return { accepted, cut_id }. interrupt=true sets priority:
 * "break" (seize now) vs "next" (queue after current element).
 */
export class AudematRestPlayout implements PlayoutSystem {
  readonly kind = "audemat-rest";

  async inject(cart: PlayoutCart, endpoint: string): Promise<PlayoutResult> {
    const body = new FormData();
    body.set(
      "audio",
      new Blob([new Uint8Array(cart.audioBuffer)], { type: "audio/mpeg" }),
      `emergency-${cart.alertId}.mp3`,
    );
    body.set(
      "meta",
      new Blob(
        [
          JSON.stringify({
            cut_id: `SAFESPHERE_${cart.alertId}`,
            title: cart.headline.slice(0, 120),
            rds_text: cart.rdsText,
            priority: cart.interrupt ? "break" : "next",
            duration_minutes: cart.durationMinutes,
          }),
        ],
        { type: "application/json" },
      ),
      "meta.json",
    );
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/v1/emergency`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearerToken()}` },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const text = (await response.text()).slice(0, 500);
      if (!response.ok) {
        return {
          ok: false,
          responseCode: response.status,
          responseBody: text,
          error: `Playout rejected (${response.status}): ${text}`,
        };
      }
      let cartId: string | undefined;
      try {
        const parsed = JSON.parse(text) as { cut_id?: string; accepted?: boolean };
        cartId = parsed.cut_id;
        if (parsed.accepted === false) {
          return { ok: false, responseCode: response.status, responseBody: text, error: "Playout refused the cart." };
        }
      } catch {
        // Non-JSON 2xx — accepted without a cut id.
      }
      return { ok: true, responseCode: response.status, responseBody: text, cartId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      safeLog("error", "[playout] Audemat inject failed", { metadata: { error: message } });
      return { ok: false, responseCode: 0, responseBody: message.slice(0, 500), error: message };
    }
  }
}

/**
 * ENPS-style MOS rundown adapter. Newsroom-driven stations take
 * story inserts over MOS (Media Object Server) protocol; here reduced
 * to the JSON profile modern ENPS gateways accept: POST
 * {endpoint}/mos/rundown/insert with the story + audio reference.
 * Audio bytes ride as a data-URI when small, else the stored audio URL.
 */
export class MosRundownPlayout implements PlayoutSystem {
  readonly kind = "mos-rundown";

  async inject(cart: PlayoutCart, endpoint: string): Promise<PlayoutResult> {
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/mos/rundown/insert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken()}`,
        },
        body: JSON.stringify({
          slug: `EMERGENCY_${cart.alertId}`.slice(0, 64),
          headline: cart.headline,
          body: cart.rdsText,
          audio_bytes: cart.audioBuffer.length,
          floating: cart.interrupt,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const text = (await response.text()).slice(0, 500);
      if (!response.ok) {
        return {
          ok: false,
          responseCode: response.status,
          responseBody: text,
          error: `MOS rundown rejected (${response.status}): ${text}`,
        };
      }
      return { ok: true, responseCode: response.status, responseBody: text };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, responseCode: 0, responseBody: message.slice(0, 500), error: message };
    }
  }
}

/** Pick the adapter from env (default Audemat REST). */
export function playoutSystemFromEnv(): PlayoutSystem {
  const kind = (process.env.PLAYOUT_KIND ?? "audemat").trim().toLowerCase();
  return kind === "mos" ? new MosRundownPlayout() : new AudematRestPlayout();
}

/** Shared gateway fallback when a station has no per-station endpoint. */
export function sharedPlayoutEndpoint(): string | null {
  const url = process.env.PLAYOUT_GATEWAY_URL?.trim();
  return url && /^https?:\/\//.test(url) ? url : null;
}
