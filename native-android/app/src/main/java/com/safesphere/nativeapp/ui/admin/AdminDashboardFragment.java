package com.safesphere.nativeapp.ui.admin;

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
 * Simplified admin home. Three live numbers, one primary action, and a short
 * list of setup tools — no dense grids or jargon.
 */
public class AdminDashboardFragment extends Fragment {

    private static class Action {
        final String icon, title, subtitle;
        final int dest;
        Action(String icon, String title, String subtitle, int dest) {
            this.icon = icon; this.title = title; this.subtitle = subtitle; this.dest = dest;
        }
    }

    @Nullable @Override
    public View onCreateView(@NonNull LayoutInflater inf, @Nullable ViewGroup c, @Nullable Bundle b) {
        return inf.inflate(R.layout.fragment_admin_dashboard, c, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setStat(view, R.id.statAlerts, "🚨", "3", "Open alerts");
        setStat(view, R.id.statReports, "📋", "12", "To review");
        setStat(view, R.id.statHealth, "✅", "Good", "System");

        List<Action> primary = new ArrayList<>();
        primary.add(new Action("📋", "Review reports",
                "12 waiting for a decision", R.id.triageDashboardFragment));
        primary.add(new Action("🚨", "Send an alert",
                "Warn people in your district", R.id.alertsFragment));
        primary.add(new Action("🗺️", "View the map",
                "Shelters, resources and risks", R.id.mapFragment));
        buildActions(view.findViewById(R.id.primaryActions), primary);

        List<Action> secondary = new ArrayList<>();
        secondary.add(new Action("🏠", "Manage shelters", "Add or update shelters", R.id.sheltersMgmtFragment));
        secondary.add(new Action("📦", "Supplies", "Check stock and depots", R.id.inventoryFragment));
        secondary.add(new Action("👥", "Manage users", "Add responders and officers", R.id.userManagementFragment));
        secondary.add(new Action("📜", "Activity log", "See who did what", R.id.auditLogsFragment));
        secondary.add(new Action("⚙️", "Settings", "Districts, limits and downloads", R.id.settingsFragment));
        buildActions(view.findViewById(R.id.secondaryActions), secondary);
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
            row.setOnClickListener(v -> navigate(action.dest));
            container.addView(row);
        }
    }

    private void navigate(int destId) {
        androidx.navigation.NavController nav =
                androidx.navigation.Navigation.findNavController(requireView());
        nav.navigate(destId);
    }
}