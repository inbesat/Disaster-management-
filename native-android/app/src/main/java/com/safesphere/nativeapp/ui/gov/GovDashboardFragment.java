package com.safesphere.nativeapp.ui.gov;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.safesphere.nativeapp.R;

import java.util.ArrayList;
import java.util.List;

/**
 * Simplified government home. Three numbers, one primary action, and a short
 * list of response tools.
 */
public class GovDashboardFragment extends Fragment {

    private static class Action {
        final String icon, title, subtitle;
        final int dest;
        Action(String icon, String title, String subtitle, int dest) {
            this.icon = icon; this.title = title; this.subtitle = subtitle; this.dest = dest;
        }
    }

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, @Nullable ViewGroup c, @Nullable Bundle b) {
        return inf.inflate(R.layout.fragment_gov_dashboard, c, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setStat(view, R.id.govStatAlerts, "🚨", "3", "Open alerts");
        setStat(view, R.id.govStatShelters, "🏠", "8", "Shelters open");
        setStat(view, R.id.govStatReports, "📋", "12", "To review");

        List<Action> primary = new ArrayList<>();
        primary.add(new Action("📋", "Review reports", "12 waiting for a decision", R.id.triageDashboardFragment));
        primary.add(new Action("🚨", "Send an alert", "Warn people in your district", R.id.alertsFragment));
        primary.add(new Action("🗺️", "View the map", "Shelters, resources and risks", R.id.mapFragment));
        buildActions(view.findViewById(R.id.govPrimaryActions), primary);

        List<Action> secondary = new ArrayList<>();
        secondary.add(new Action("🏠", "Shelters", "Add or update shelters", R.id.sheltersMgmtFragment));
        secondary.add(new Action("📦", "Supplies", "Check stock and depots", R.id.inventoryFragment));
        secondary.add(new Action("🚶", "Evacuations", "Plan and track movements", R.id.evacuationsFragment));
        secondary.add(new Action("🤖", "AI planner", "Draft a response plan", R.id.aiPlannerFragment));
        secondary.add(new Action("📚", "Knowledge base", "Field guides and SOPs", R.id.knowledgeBaseFragment));
        secondary.add(new Action("⚙️", "Settings", "Limits, downloads and more", R.id.settingsFragment));
        buildActions(view.findViewById(R.id.govSecondaryActions), secondary);
    }

    private void setStat(View root, int containerId, String icon, String value, String label) {
        View stat = root.findViewById(containerId);
        ((TextView) stat.findViewById(R.id.statIcon)).setText(icon);
        ((TextView) stat.findViewById(R.id.statValue)).setText(value);
        ((TextView) stat.findViewById(R.id.statLabel)).setText(label);
    }

    private void buildActions(LinearLayout container, List<Action> actions) {
        LayoutInflater inflater = LayoutInflater.from(container.getContext());
        for (Action action : actions) {
            View row = inflater.inflate(R.layout.item_simple_action, container, false);
            ((TextView) row.findViewById(R.id.actionIcon)).setText(action.icon);
            ((TextView) row.findViewById(R.id.actionTitle)).setText(action.title);
            ((TextView) row.findViewById(R.id.actionSubtitle)).setText(action.subtitle);
            row.setOnClickListener(v ->
                    androidx.navigation.Navigation.findNavController(v).navigate(action.dest));
            container.addView(row);
        }
    }
}