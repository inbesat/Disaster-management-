package com.safesphere.nativeapp.ai;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import com.safesphere.nativeapp.R;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import okhttp3.*;

/** Provider credentials stay on SafeSphere's server, never inside an APK. */
public final class CloudChatClient {
    private static final OkHttpClient CLIENT = new OkHttpClient.Builder().callTimeout(60, TimeUnit.SECONDS).build();
    private final Handler main = new Handler(Looper.getMainLooper());
    public interface Listener { void complete(String text, String source); }
    public static boolean isOnline(Context context) {
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities caps = cm == null ? null : cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
    public Call send(Context context, JSONArray messages, Listener listener) {
        try {
            String base = context.getString(R.string.api_base_url).replaceAll("/+$", "");
            if (!base.startsWith("https://")) throw new IllegalArgumentException("HTTPS server required");
            JSONObject payload = new JSONObject().put("messages", messages).put("responseFormat", "json");
            Request request = new Request.Builder().url(base + "/api/chat")
                .post(RequestBody.create(payload.toString(), MediaType.get("application/json"))).build();
            Call call = CLIENT.newCall(request);
            call.enqueue(new Callback() {
                public void onFailure(Call c, IOException e) {
                    if (!c.isCanceled()) main.post(() -> listener.complete("Unable to reach the AI server. Check your connection and retry.", "UNAVAILABLE"));
                }
                public void onResponse(Call c, Response response) {
                    try (Response r = response) {
                        JSONObject data = new JSONObject(r.body() == null ? "{}" : r.body().string());
                        String message = data.optString("message");
                        if (!r.isSuccessful() || message.trim().isEmpty()) throw new IOException("AI response unavailable");
                        String provider = data.optString("aiProvider", "CLOUD");
                        if (!c.isCanceled()) main.post(() -> listener.complete(message, provider));
                    } catch (Exception e) {
                        if (!c.isCanceled()) main.post(() -> listener.complete("AI is unavailable. The server may need the latest SafeSphere deployment or provider configuration. Please retry.", "UNAVAILABLE"));
                    }
                }
            });
            return call;
        } catch (Exception e) { main.post(() -> listener.complete("AI server configuration is invalid.", "UNAVAILABLE")); return null; }
    }
}
