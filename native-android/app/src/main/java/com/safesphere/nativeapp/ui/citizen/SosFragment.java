package com.safesphere.nativeapp.ui.citizen;

import android.Manifest;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.safesphere.nativeapp.R;
import com.safesphere.nativeapp.data.entity.SosEventEntity;
import com.safesphere.nativeapp.data.repository.SosEventRepository;
import com.safesphere.nativeapp.sync.SyncWorker;
import com.safesphere.nativeapp.ui.base.BaseFragment;
import com.safesphere.nativeapp.util.LocationHelper;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class SosFragment extends BaseFragment {

    private static final long COUNTDOWN_TICK_MS = 1000L;

    private SosEventRepository sosRepository;
    private GridLayout sosGrid, helplineGrid;
    private TextView gpsTitleText, gpsStatusText, gpsIcon;
    private Button gpsRetryBtn;
    private LinearLayout sosHistoryContainer;

    /** Latest known fix; refreshed on entry and before each send. */
    private double lastLat = Double.NaN;
    private double lastLng = Double.NaN;
    private float lastAccuracy = -1f;

    private final Handler countdownHandler = new Handler(Looper.getMainLooper());
    private TextView countdownNumberView;
    private int countdownRemaining;
    private String pendingSosType;
    private boolean countdownCancelled;

    @Override
    protected int getLayoutRes() {
        return R.layout.fragment_sos;
    }

    @Override
    protected void initViews(View view) {
        sosRepository = new SosEventRepository(requireActivity().getApplication());
        sosGrid = view.findViewById(R.id.sosGrid);
        helplineGrid = view.findViewById(R.id.helplineGrid);
        gpsTitleText = view.findViewById(R.id.gpsTitleText);
        gpsStatusText = view.findViewById(R.id.gpsStatusText);
        gpsIcon = view.findViewById(R.id.gpsIcon);
        gpsRetryBtn = view.findViewById(R.id.gpsRetryBtn);
        sosHistoryContainer = view.findViewById(R.id.sosHistoryContainer);

        gpsRetryBtn.setOnClickListener(v -> acquireLocation());

        setupSosButtons();
        setupHelplines();
        loadSosHistory();

        withPermission(Manifest.permission.ACCESS_FINE_LOCATION, this::acquireLocation);
    }

    // ------------------------------------------------------------------ GPS

    private void acquireLocation() {
        gpsTitleText.setText("Acquiring GPS…");
        gpsStatusText.setText("Getting the most accurate position possible.");
        gpsRetryBtn.setVisibility(View.GONE);

        LocationHelper.getCurrentLocation(this, new LocationHelper.Callback() {
            @Override
            public void onLocation(double lat, double lng, float accuracyMeters) {
                if (!isAdded()) return;
                lastLat = lat;
                lastLng = lng;
                lastAccuracy = accuracyMeters;
                gpsIcon.setText("✅");
                gpsTitleText.setText(LocationHelper.formatCoord(lat, lng));
                String suffix = accuracyMeters > 0
                        ? String.format(Locale.US, " (±%.0f m)", accuracyMeters) : "";
                gpsStatusText.setText("Your location will be attached to SOS alerts" + suffix);
            }

            @Override
            public void onUnavailable(@NonNull String reason) {
                if (!isAdded()) return;
                gpsIcon.setText("⚠️");
                switch (reason) {
                    case "permission_denied":
                        gpsTitleText.setText("Location permission needed");
                        gpsStatusText.setText("Grant location access so responders can find you.");
                        break;
                    case "no_gps_fix":
                    case "gps_error":
                        gpsTitleText.setText("GPS signal not found");
                        gpsStatusText.setText("Move to an open area or enable location services.");
                        break;
                    default:
                        gpsTitleText.setText("Location unavailable");
                        gpsStatusText.setText(reason);
                }
                gpsRetryBtn.setVisibility(View.VISIBLE);
            }
        });
    }

    // ----------------------------------------------------------- SOS actions

    private void setupSosButtons() {
        String[][] sosActions = {
                {"I Need Rescue", "🚤", "#EF4444"},
                {"Medical Emergency", "🚑", "#EF4444"},
                {"Share Location", "📍", "#F59E0B"},
                {"Call Helpline", "☎️", "#3B82F6"},
                {"I Am Safe", "✅", "#22C55E"},
                {"Report Hazard", "⚠️", "#F59E0B"}
        };

        for (int i = 0; i < sosActions.length; i++) {
            String[] action = sosActions[i];
            View card = LayoutInflater.from(requireContext()).inflate(R.layout.item_sos_action, sosGrid, false);
            TextView title = card.findViewById(R.id.sosActionTitle);
            TextView icon = card.findViewById(R.id.sosActionIcon);
            title.setText(action[0]);
            icon.setText(action[1]);
            card.setBackgroundColor(android.graphics.Color.parseColor(action[2]));
            card.setOnClickListener(v -> startCountdown(action[0]));

            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = 0;
            params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            params.rowSpec = GridLayout.spec(i / 2);
            params.setMargins(8, 8, 8, 8);
            card.setLayoutParams(params);
            sosGrid.addView(card);
        }
    }

    /** 3-2-1 confirmation. Auto-sends unless cancelled. */
    private void startCountdown(String action) {
        pendingSosType = action;
        countdownRemaining = 3;
        countdownCancelled = false;

        LinearLayout box = new LinearLayout(requireContext());
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(android.view.Gravity.CENTER);
        box.setPadding(32, 24, 32, 24);

        TextView label = new TextView(requireContext());
        label.setText("Sending \"" + action + "\"\nwith your GPS location");
        label.setTextSize(15f);
        label.setTextColor(requireContext().getColor(R.color.textSecondary));
        label.setGravity(android.view.Gravity.CENTER);

        countdownNumberView = new TextView(requireContext());
        countdownNumberView.setText("3");
        countdownNumberView.setTextSize(72f);
        countdownNumberView.setTextColor(requireContext().getColor(R.color.colorCritical));
        countdownNumberView.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams numParams =
                new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT);
        numParams.topMargin = 16;
        countdownNumberView.setLayoutParams(numParams);

        box.addView(label);
        box.addView(countdownNumberView);

        androidx.appcompat.app.AlertDialog dialog =
                new MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Emergency SOS")
                        .setView(box)
                        .setNegativeButton("Cancel", (d, w) -> {
                            countdownCancelled = true;
                            countdownHandler.removeCallbacksAndMessages(null);
                        })
                        .show();

        tickCountdown(dialog);
    }

    private void tickCountdown(androidx.appcompat.app.AlertDialog dialog) {
        if (countdownCancelled) return;
        if (countdownNumberView != null) {
            countdownNumberView.setText(String.valueOf(countdownRemaining));
        }
        if (countdownRemaining <= 0) {
            if (dialog != null && dialog.isShowing()) dialog.dismiss();
            sendSos(pendingSosType);
            return;
        }
        countdownRemaining--;
        countdownHandler.postDelayed(() -> tickCountdown(dialog), COUNTDOWN_TICK_MS);
    }

    private void sendSos(String type) {
        Runnable doSend = () -> {
            if (!isAdded()) return;

            SosEventEntity event = new SosEventEntity();
            event.id = "sos-" + System.currentTimeMillis();
            String userId = roleManager.getUserId();
            event.userId = userId != null ? userId : "user-3";
            event.type = type.toLowerCase(Locale.US).replace(" ", "_");
            event.lat = Double.isNaN(lastLat) ? SafeSphereMapHelperFallback.DEMO_LAT : lastLat;
            event.lng = Double.isNaN(lastLng) ? SafeSphereMapHelperFallback.DEMO_LNG : lastLng;
            event.message = "SOS: " + type;
            // Phase 0 honesty fix: captured = on-device only, nothing transmitted yet.
            // Phase 1+ transports (api/sms/mesh) promote this to queued → sent_*.
            event.status = "captured";
            event.createdAt = utcNow();

            sosRepository.insertSosEvent(event);
            loadSosHistory();
            // Phase 1: attempt the outbox drain immediately — when online this
            // promotes captured → sent_api within seconds; when offline the
            // periodic worker retries. Either way the Snackbar below stays honest.
            try {
                SyncWorker.triggerImmediateSync(requireContext());
            } catch (Exception ignored) {
                // Sync scheduling must never break SOS capture.
            }

            String coordNote = Double.isNaN(lastLat)
                    ? "(no GPS — using district center)" : LocationHelper.formatCoord(lastLat, lastLng);
            com.google.android.material.snackbar.Snackbar
                    .make(requireView(), "SOS captured locally: " + type + " · " + coordNote + " · will relay when a channel is available", com.google.android.material.snackbar.Snackbar.LENGTH_LONG)
                    .setBackgroundTint(requireContext().getColor(R.color.colorWarning))
                    .show();
        };

        if (Double.isNaN(lastLat)) {
            // Try one fresh fix right before transmitting.
            withPermission(Manifest.permission.ACCESS_FINE_LOCATION, () ->
                    LocationHelper.getCurrentLocation(this, new LocationHelper.Callback() {
                        @Override
                        public void onLocation(double lat, double lng, float acc) {
                            lastLat = lat;
                            lastLng = lng;
                            lastAccuracy = acc;
                            doSend.run();
                        }

                        @Override
                        public void onUnavailable(@NonNull String reason) {
                            doSend.run(); // still send with fallback coords
                        }
                    }));
        } else {
            doSend.run();
        }
    }

    /** Keeps constants local so this fragment never depends on map code. */
    private static final class SafeSphereMapHelperFallback {
        static final double DEMO_LAT = 25.5941;
        static final double DEMO_LNG = 85.1376;
    }

    // ------------------------------------------------------------ helplines

    private void setupHelplines() {
        String[][] helplines = {
                {"Control Room", "1070", "☎️"},
                {"Police", "100", "👮"},
                {"Ambulance", "108", "🚑"},
                {"Fire", "101", "🚒"}
        };

        for (int i = 0; i < helplines.length; i++) {
            String[] h = helplines[i];
            View card = LayoutInflater.from(requireContext()).inflate(R.layout.item_emergency_contact, helplineGrid, false);
            TextView name = card.findViewById(R.id.contactName);
            TextView number = card.findViewById(R.id.contactNumber);
            TextView icon = card.findViewById(R.id.contactIcon);
            name.setText(h[0]);
            number.setText(h[1]);
            icon.setText(h[2]);

            final int idx = i;
            card.setOnClickListener(v -> {
                android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_DIAL);
                intent.setData(android.net.Uri.parse("tel:" + helplines[idx][1]));
                startActivity(intent);
            });

            GridLayout.LayoutParams params = new GridLayout.LayoutParams();
            params.width = 0;
            params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
            params.rowSpec = GridLayout.spec(i / 2);
            card.setLayoutParams(params);
            helplineGrid.addView(card);
        }
    }

    // --------------------------------------------------------------- history

    private void loadSosHistory() {
        String userId = roleManager.getUserId();
        sosRepository.getSosEventsByUserId(userId != null ? userId : "user-3")
                .observe(getViewLifecycleOwner(), events -> renderHistory(events));
    }

    private void renderHistory(List<SosEventEntity> events) {
        if (!isAdded() || sosHistoryContainer == null) return;
        sosHistoryContainer.removeAllViews();
        if (events == null || events.isEmpty()) return;

        List<SosEventEntity> recent = events.size() > 3
                ? events.subList(events.size() - 3, events.size()) : events;

        for (int i = recent.size() - 1; i >= 0; i--) {
            SosEventEntity e = recent.get(i);
            View row = LayoutInflater.from(requireContext())
                    .inflate(R.layout.item_sos_history_row, sosHistoryContainer, false);
            ((TextView) row.findViewById(R.id.historyType)).setText(prettify(e.type));
            ((TextView) row.findViewById(R.id.historyCoords))
                    .setText(LocationHelper.formatCoord(e.lat, e.lng));
            ((TextView) row.findViewById(R.id.historyTime)).setText(shortTime(e.createdAt));
            sosHistoryContainer.addView(row);
        }
    }

    private String prettify(String type) {
        if (type == null) return "SOS";
        return type.substring(0, 1).toUpperCase(Locale.US) + type.substring(1).replace('_', ' ');
    }

    private String shortTime(String iso) {
        try {
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
            Date d = in.parse(iso);
            SimpleDateFormat out = new SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault());
            return d == null ? iso : out.format(d);
        } catch (Exception e) {
            return iso;
        }
    }

    private static String utcNow() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(new Date());
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        countdownHandler.removeCallbacksAndMessages(null);
    }
}