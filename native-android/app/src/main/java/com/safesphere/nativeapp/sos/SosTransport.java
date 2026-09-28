package com.safesphere.nativeapp.sos;

/**
 * Phase 0 — Transmission-ladder contract (see docs/OFFLINE_SOS_SCOPE.md).
 *
 * <p>Every offline SOS channel implements this interface so Phases 1–5 are
 * implementations, not rewrites: api → sms → wifi_direct → ble_mesh →
 * ble_satellite → satellite_guided. The ladder tries each transport from best
 * to worst, records which rung carried the SOS, and never drops the signal.
 *
 * <p>Transports never fake delivery: report what actually happened via
 * {@link Callback}. "captured"/"queued" stay on-device; only a real handoff
 * may promote the event to a {@code sent_*} state.
 */
public interface SosTransport {

    /** Stable rung id: "api" | "sms" | "wifi_direct" | "ble_mesh" | "ble_satellite" | "satellite_guided". */
    String id();

    /** Runtime capability check (permission + hardware + OS state) — never a guess. */
    boolean isAvailable();

    /** Attempt delivery of one SOS payload. Always calls back exactly once. */
    void send(SosPayload payload, Callback callback);

    /** Exactly-once outcome for one send attempt. */
    interface Callback {
        /** Handed to the channel (e.g. SMS accepted by the radio, mesh packet broadcast). */
        void onSent(String transportId);

        /**
         * Channel-level failure (no radio, no peer, rejected). The ladder then
         * tries the next rung; the event stays queued and retryable.
         */
        void onFailed(String transportId, String reason);
    }
}
