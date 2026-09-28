package com.safesphere.nativeapp.data.entity;

import androidx.room.Entity;
import androidx.annotation.NonNull;
import androidx.room.PrimaryKey;

@Entity(tableName = "sos_events")
public class SosEventEntity {
    @PrimaryKey
        @NonNull public String id;
    public String userId;
    public String type; // rescue, medical, location_share, helpline, safe
    public double lat;
    public double lng;
    public String message;
    /**
     * Delivery lifecycle — single source of truth (see docs/OFFLINE_SOS_SCOPE.md).
     *
     * captured → queued → sent_api | sent_sms | sent_wifi_direct | sent_ble_mesh
     *          | sent_ble_satellite | satellite_guided → delivered | failed
     *
     * "captured" means on-device only — nothing has left the phone.
     * Never write "sent" without a named transport; a false "sent" is worse
     * than a visible "pending". Transport detail lives in SosTransport
     * implementations (Phase 1+) — this column records the outcome, not the attempt.
     * Legacy rows may still carry "sent" | "cancelled" | "completed".
     */
    public String status; // lifecycle state — see comment above
    public String resolution;
    public String createdAt;
    public String resolvedAt;
}