package com.safesphere.nativeapp.sync;

import android.content.Context;

import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.safesphere.nativeapp.sos.SosSync;
import com.safesphere.nativeapp.util.ConnectivityMonitor;

import java.util.concurrent.TimeUnit;

public class SyncWorker extends Worker {

    public SyncWorker(Context context, WorkerParameters params) {
        super(context, params);
    }

    @Override
    public Result doWork() {
        if (!ConnectivityMonitor.getInstance(getApplicationContext()).isOnline()) {
            return Result.retry();
        }

        try {
            // Phase 1: drain the SOS outbox (captured/queued → sent_api) before
            // anything else — a distress signal outranks every other dataset.
            SosSync.DrainResult sos = SosSync.drainPending(getApplicationContext());
            android.util.Log.d("SyncWorker",
                    "SOS drain: delivered=" + sos.delivered
                            + " failed=" + sos.failed
                            + " remaining=" + sos.remaining);

            // TODO (Phase 1+): drain remaining datasets (alerts, shelters,
            // resources) through the same ladder. SOS goes first by design.
            android.util.Log.d("SyncWorker", "Periodic sync executed");

            return sos.remaining > 0 ? Result.retry() : Result.success();
        } catch (Exception e) {
            android.util.Log.e("SyncWorker", "Sync failed", e);
            return Result.retry();
        }
    }

    public static void schedulePeriodicSync(Context context) {
        PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(SyncWorker.class, 15, TimeUnit.MINUTES)
                .setInitialDelay(1, TimeUnit.MINUTES)
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "periodic_sync",
                androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
        );
    }

    public static void triggerImmediateSync(Context context) {
        WorkManager.getInstance(context).enqueueUniqueWork(
                "immediate_sync",
                androidx.work.ExistingWorkPolicy.REPLACE,
                new androidx.work.OneTimeWorkRequest.Builder(SyncWorker.class).build()
        );
    }
}