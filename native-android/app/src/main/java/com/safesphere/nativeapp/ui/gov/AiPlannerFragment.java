package com.safesphere.nativeapp.ui.gov;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.safesphere.nativeapp.R;
import com.safesphere.nativeapp.ai.CloudChatClient;
import org.json.JSONArray;
import org.json.JSONObject;
import okhttp3.Call;
import com.safesphere.nativeapp.ui.base.BaseFragment;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class AiPlannerFragment extends BaseFragment {

    private RecyclerView chatRecyclerView, sourcesRecyclerView;
    private com.google.android.material.textfield.TextInputEditText chatInput;
    private ImageButton sendBtn, voiceBtn;
    private TextView tokenCounter;
    private ChipGroup promptChips;
    private Call pendingCall;
    private boolean sending;

    @Override
    protected int getLayoutRes() {
        return R.layout.fragment_ai_planner;
    }

    @Override
    protected void initViews(View view) {
        chatRecyclerView = view.findViewById(R.id.chatRecyclerView);
        sourcesRecyclerView = view.findViewById(R.id.sourcesRecyclerView);
        chatInput = view.findViewById(R.id.chatInput);
        sendBtn = view.findViewById(R.id.sendBtn);
        voiceBtn = view.findViewById(R.id.voiceBtn);
        tokenCounter = view.findViewById(R.id.tokenCounter);
        promptChips = view.findViewById(R.id.promptChips);

        chatRecyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));
        sourcesRecyclerView.setLayoutManager(new LinearLayoutManager(requireContext()));

        setupChat();
        setupPromptChips();
        setupSendButton();
    }

    private void setupChat() {
        List<ChatMessage> messages = new ArrayList<>();
        messages.add(new ChatMessage("assistant", "Ready for tactical planning. Ask me to draft a 48-hour evacuation plan for any district.", null));
        chatRecyclerView.setAdapter(new ChatAdapter(messages));
    }

    private void setupPromptChips() {
        String[] prompts = {"Draft 48h plan for Kankarbagh", "Shelter capacity report", "Resource allocation for Patna", "Flood risk assessment Ernakulam"};
        for (String p : prompts) {
            Chip chip = new Chip(requireContext());
            chip.setText(p);
            chip.setOnClickListener(v -> {
                chatInput.setText(p);
                sendMessage(p);
            });
            promptChips.addView(chip);
        }
    }

    private void setupSendButton() {
        sendBtn.setOnClickListener(v -> {
            String text = chatInput.getText() != null ? chatInput.getText().toString().trim() : "";
            if (!text.isEmpty()) {
                sendMessage(text);
                chatInput.setText("");
            }
        });
    }

    private void sendMessage(String text) {
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

    // Data classes & Adapters
    static class ChatMessage { String role, content; List<String> sources; ChatMessage(String r, String c, List<String> s) { role=r; content=c; sources=s; } }

    static class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.VH> {
        List<ChatMessage> items = new ArrayList<>();
        ChatAdapter(List<ChatMessage> items) { this.items = items; }
        void addUserMessage(String text) { items.add(new ChatMessage("user", text, null)); notifyItemInserted(items.size()-1); }
        void addAssistantMessage(String text) { items.add(new ChatMessage("assistant", text, null)); notifyItemInserted(items.size()-1); }
        @NonNull @Override public VH onCreateViewHolder(@NonNull ViewGroup p, int v) { View view = LayoutInflater.from(p.getContext()).inflate(R.layout.item_chat_message, p, false); return new VH(view); }
        @Override public void onBindViewHolder(@NonNull VH h, int pos) { ChatMessage m = items.get(pos); h.role.setText(m.role.equals("user") ? "You" : "AI"); h.content.setText(m.content); h.itemView.setBackgroundColor(h.itemView.getContext().getColor(m.role.equals("user") ? R.color.bgSurface : R.color.bgSecondary)); }
        @Override public int getItemCount() { return items.size(); }
        static class VH extends RecyclerView.ViewHolder { TextView role, content; VH(View v) { super(v); role = v.findViewById(R.id.chatTime); content = v.findViewById(R.id.chatMessage); } }
    }

    static class SourceAdapter extends RecyclerView.Adapter<SourceAdapter.VH> {
        List<String> items = new ArrayList<>();
        @NonNull @Override public VH onCreateViewHolder(@NonNull ViewGroup p, int v) { View view = LayoutInflater.from(p.getContext()).inflate(R.layout.item_source, p, false); return new VH(view); }
        @Override public void onBindViewHolder(@NonNull VH h, int pos) { h.text.setText(items.get(pos)); }
        @Override public int getItemCount() { return items.size(); }
        static class VH extends RecyclerView.ViewHolder { TextView text; VH(View v) { super(v); text = v.findViewById(R.id.sourceText); } }
    }
}