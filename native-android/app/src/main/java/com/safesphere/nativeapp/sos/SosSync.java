package com.safesphere.nativeapp.sos;

import android.content.Context;
import android.util.Log;

import com.safesphere.nativeapp.R;
import com.safesphere.nativeapp.data.dao.SosEventDao;
import com.safesphere.nativeapp.data.db.SafeSphereDatabase;
import com.safesphere.nativeapp.data.entity.SosEventEntity;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Phase 1 — Native outbox drain for the {@code api} rung of the transmission
 * ladder (see docs/OFFLINE_SOS_SCOPE.md).
 *
 * <p>Reads every {@code captured}/{@code queued} SOS event from Room and POSTs
 * it to the public {@code /api/sos} endpoint (no-auth, same contract as the
 * PWA). Each POST carries {@code clientId = event.id} so server-side dedupe
 * (sessionId {@code sos:<clientId>}) makes retries idempotent.
 *
 * <p>Outcomes are written back to Room — never faked:
 * <ul>
 *   <li>{@code sent_api} — server acknowledged (2xx + ok:true).</li>
 *   <li>{@code failed} — server rejected the payload (validation). Not retried.</li>
 *   <li>unchanged ({@code captured}/{@code queued}) — network down or 5xx; retried later.</li>
 * </ul>
 *
 * <p>All calls are synchronous OkHttp — invoke from a Worker thread only.
 */
public final class SosSync {

    private static final String TAG = "SosSync";

    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .callTimeout(30, TimeUnit.SECONDS)
            .build();

    /** Result counts for one drain pass. */
    public static final class DrainResult {
        public int delivered;
        public int failed;
        public int remaining;
    }

    private SosSync() {
    }

    public static DrainResult drainPending(Context context) {
        DrainResult result = new DrainResult();
        SafeSphereDatabase db = SafeSphereDatabase.getInstance(context);
        SosEventDao dao = db.sosEventDao();

        List<SosEventEntity> pending;
        try {
            pending = dao.getPendingSync();
        } catch (Exception e) {
            Log.e(TAG, "Outbox read failed", e);
            return result;
        }
        if (pending == null || pending.isEmpty()) return result;

        String base;
        try {
            base = context.getString(R.string.api_base_url).replaceAll("/+$", "");
            if (!base.startsWith("https://")) throw new IllegalArgumentException("HTTPS server required");
        } catch (Exception e) {
            Log.e(TAG, "Invalid API base URL", e);
            result.remaining = pending.size();
            return result;
        }

        for (SosEventEntity event : pending) {
            try {
                JSONObject body = new JSONObject()
                        .put("clientId", event.id)
                        .put("message", event.message != null ? event.message : "SOS — Emergency assistance needed")
                        .put("lat", event.lat)
                        .put("lng", event.lng);
                // Phase 2: attach the compact relay code so the server decoder
                // path is exercised from native too (re-typable into satellite
                // messengers, QR-able). Codec failure must never block the POST.
                String codec = encodeRelayCode(event);
                if (codec != null) body.put("codec", codec);

                Request request = new Request.Builder()
                        .url(base + "/api/sos")
                        .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                        .build();

                try (Response response = CLIENT.newCall(request).execute()) {
                    String raw = response.body() == null ? "{}" : response.body().string();
                    boolean ok = response.isSuccessful() && new JSONObject(raw).optBoolean("ok", false);
                    if (ok) {
                        event.status = "sent_api";
                        event.resolution = "Server acknowledged at " + utcNow();
                        dao.update(event);
                        result.delivered++;
                    } else if (response.code() == 422 || response.code() == 400) {
                        // Validation rejection — retrying won't help.
                        event.status = "failed";
                        event.resolution = "Rejected by server (HTTP " + response.code() + ")";
                        dao.update(event);
                        result.failed++;
                    } else {
                        result.remaining++;
                    }
                }
            } catch (Exception e) {
                // Network down or transient — leave queued for the next pass.
                Log.d(TAG, "SOS " + event.id + " still queued: " + e.getMessage());
                result.remaining++;
            }
        }
        Log.d(TAG, "Drain pass: delivered=" + result.delivered
                + " failed=" + result.failed + " remaining=" + result.remaining);
        return result;
    }

    /**
     * Phase 2 — builds the compact relay code for an event, or null when the
     * event type has no codec need mapping (e.g. "I Am Safe" must never be
     * misreported as a rescue). Never throws — codec failure returns null so
     * the POST still goes out with the full JSON body.
     */
    private static String encodeRelayCode(SosEventEntity event) {
        try {
            String type = event.type != null ? event.type.toLowerCase(java.util.Locale.US) : "";
            char need;
            if (type.contains("medical")) need = 'M';
            else if (type.contains("hazard")) need = 'H';
            else if (type.contains("location") || type.contains("share")) need = 'L';
            else if (type.contains("food")) need = 'F';
            else if (type.contains("safe") || type.contains("helpline")) return null;
            else need = 'R';
            // Native events always carry coordinates (district fallback at worst).
            return SosCodec.encode(event.lat, event.lng, need, false, new Date());
        } catch (Exception e) {
            Log.d(TAG, "Relay code skipped: " + e.getMessage());
            return null;
        }
    }

    private static String utcNow() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(new Date());
    }
}
