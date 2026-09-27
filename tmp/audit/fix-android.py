from pathlib import Path
base=Path('native-android/app/src/main/java/com/safesphere/nativeapp')
p=base/'ai/CloudChatClient.java';p.write_text('''package com.safesphere.nativeapp.ai;

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
''')
p=base/'ui/citizen/NovaChatFragment.java';s=p.read_text();s=s.replace('import com.safesphere.nativeapp.ai.NovaRuleEngine;','import com.safesphere.nativeapp.ai.NovaRuleEngine;\nimport com.safesphere.nativeapp.ai.CloudChatClient;\nimport org.json.JSONArray;\nimport org.json.JSONObject;\nimport okhttp3.Call;');s=s.replace('    private ChatAdapter adapter;','    private ChatAdapter adapter;\n    private Call pendingCall;\n    private boolean sending;');s=s.replace('I work offline with 61 emergency rules.','I use cloud AI when connected and clearly marked safety rules when offline.');a=s.index('        new android.os.Handler');b=s.index('\n    private String formatTime',a);s=s[:a]+'''        sending = true;
        chatInput.setText("");
        if (!CloudChatClient.isOnline(requireContext())) {
            NovaRuleEngine.Result result = NovaRuleEngine.generateResponse(text);
            addReply(result.text, "OFFLINE GUIDANCE");
            return;
        }
        JSONArray history = new JSONArray();
        try {
            for (int i = Math.max(1, messages.size() - 20); i < messages.size(); i++) {
                ChatMessage m = messages.get(i);
                history.put(new JSONObject().put("role", m.isBot ? "assistant" : "user").put("content", m.text));
            }
        } catch (Exception e) { addReply("Could not prepare message. Please retry.", "UNAVAILABLE"); return; }
        pendingCall = new CloudChatClient().send(requireContext(), history, this::addReply);
    }
    private void addReply(String text, String source) {
        sending = false;
        if (!isAdded() || getView() == null) return;
        messages.add(new ChatMessage(text, true, formatTime(System.currentTimeMillis()), source));
        adapter.notifyItemInserted(messages.size() - 1);
        chatRecyclerView.scrollToPosition(messages.size() - 1);
    }
    @Override public void onDestroyView() {
        if (pendingCall != null) pendingCall.cancel();
        sending = false;
        super.onDestroyView();
    }
'''+s[b:];s=s.replace('    private void sendMessage(String text) {','    private void sendMessage(String text) {\n        if (sending || text.trim().isEmpty()) return;');p.write_text(s)
p=base/'ui/gov/AiPlannerFragment.java';s=p.read_text().replace('import com.safesphere.nativeapp.R;','import com.safesphere.nativeapp.R;\nimport com.safesphere.nativeapp.ai.CloudChatClient;\nimport org.json.JSONArray;\nimport org.json.JSONObject;\nimport okhttp3.Call;');s=s.replace('    private ChipGroup promptChips;','    private ChipGroup promptChips;\n    private Call pendingCall;\n    private boolean sending;');a=s.index('    private void sendMessage(');b=s.index('    // Data classes',a);s=s[:a]+'''    private void sendMessage(String text) {
        if (sending || text.trim().isEmpty()) return;
        ChatAdapter adapter = (ChatAdapter) chatRecyclerView.getAdapter();
        if (adapter == null) return;
        adapter.addUserMessage(text);
        chatInput.setText("");
        sending = true;
        sendBtn.setEnabled(false);
        JSONArray history = new JSONArray();
        try {
            for (int i = Math.max(1, adapter.items.size() - 20); i < adapter.items.size(); i++) {
                ChatMessage m = adapter.items.get(i);
                history.put(new JSONObject().put("role", m.role).put("content", m.content));
            }
        } catch (Exception e) { sending = false; sendBtn.setEnabled(true); return; }
        pendingCall = new CloudChatClient().send(requireContext(), history, (reply, source) -> {
            sending = false;
            if (!isAdded() || getView() == null) return;
            sendBtn.setEnabled(true);
            adapter.addAssistantMessage(reply);
            tokenCounter.setText(source);
            chatRecyclerView.scrollToPosition(adapter.getItemCount() - 1);
        });
    }
    @Override public void onDestroyView() {
        if (pendingCall != null) pendingCall.cancel();
        sending = false;
        super.onDestroyView();
    }

'''+s[b:];s=s.replace('Arrays.asList("Shelter DB", "Satellite Data")','null');s=s.replace('List<String> items = Arrays.asList("🏥 Shelter Database [Patna] — 450 capacity", "🛰️ Satellite Flood Data [Patna] — 0.8m rise");','List<String> items = new ArrayList<>();');p.write_text(s)
p=Path('native-android/app/build.gradle.kts');s=p.read_text();s=s.replace('        versionName = "1.0"','        versionName = "1.1"\n        resValue("string", "api_base_url", providers.gradleProperty("SAFESPHERE_SERVER_URL").getOrElse("https://safesphere0.netlify.app"))');s=s.replace('versionCode = 1','versionCode = 2');p.write_text(s)
print('Native citizen and planner chats now use server-side AI with cancellation and conversation history.')
