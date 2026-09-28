package com.safesphere.nativeapp.sos;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/**
 * Phase 0 — Channel-agnostic SOS payload.
 *
 * <p>Carried unchanged across every {@link SosTransport} rung so the message
 * survives degradation from API JSON down to a ~60-char mesh/SMS codec
 * (Phase 2) without losing identity, position, or triage priority.
 */
public final class SosPayload {

    /** Client-generated id (e.g. "sos-<epochMs>"). Server dedupes on this. */
    @NonNull public final String sosId;

    /** Free-form need type from the SOS grid ("I Need Rescue", "Medical Emergency", …). */
    @NonNull public final String type;

    public final double lat;
    public final double lng;

    /** True when coordinates are the district fallback, not a real GPS fix. */
    public final boolean locationEstimated;

    /** GPS accuracy radius in metres, or negative when unknown. */
    public final float accuracyMeters;

    /** Person-with-disability priority flag (never dropped across codecs). */
    public final boolean isPwd;

    /** PWD detail text, may be null. */
    @Nullable public final String pwdDetails;

    /** Optional short human message. */
    @Nullable public final String message;

    /** ISO-8601 UTC creation time. */
    @NonNull public final String createdAt;

    public SosPayload(
            @NonNull String sosId,
            @NonNull String type,
            double lat,
            double lng,
            boolean locationEstimated,
            float accuracyMeters,
            boolean isPwd,
            @Nullable String pwdDetails,
            @Nullable String message,
            @NonNull String createdAt) {
        this.sosId = sosId;
        this.type = type;
        this.lat = lat;
        this.lng = lng;
        this.locationEstimated = locationEstimated;
        this.accuracyMeters = accuracyMeters;
        this.isPwd = isPwd;
        this.pwdDetails = pwdDetails;
        this.message = message;
        this.createdAt = createdAt;
    }
}
