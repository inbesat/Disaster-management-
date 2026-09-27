from pathlib import Path
p=Path('app/public/alerts/page.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('''export default function PublicAlertsPage() {''','''const DEMO_ALERTS_ENABLED = process.env.NEXT_PUBLIC_DEMO_DATA_ENABLED === "true";

export default function PublicAlertsPage() {''')
s=s.replace('''    cacheAlerts(PUBLIC_ALERTS);
    const cached = readCachedAlerts();
    if (cached.alerts) setCachedAlerts(cached.alerts);
    setCachedAtLabel(formatCachedAt(cached.cachedAt));''','''    if (!DEMO_ALERTS_ENABLED) return;
    cacheAlerts(PUBLIC_ALERTS);
    const cached = readCachedAlerts();
    if (cached.alerts) setCachedAlerts(cached.alerts);
    setCachedAtLabel(formatCachedAt(cached.cachedAt));''')
s=s.replace('''      if (!seen && PUBLIC_ALERTS.some((a) => a.severity === "critical")) {''','''      if (DEMO_ALERTS_ENABLED && !seen && PUBLIC_ALERTS.some((a) => a.severity === "critical")) {''')
s=s.replace('''      if (alert) setExtraAlerts((prev) => [alert, ...prev].slice(0, 10));''','''      if (DEMO_ALERTS_ENABLED && alert) setExtraAlerts((prev) => [alert, ...prev].slice(0, 10));''')
s=s.replace('''  const base = [
    ...(offline && cachedAlerts ? cachedAlerts : PUBLIC_ALERTS),
    ...extraAlerts,
  ];''','''  const base = DEMO_ALERTS_ENABLED
    ? [...(offline && cachedAlerts ? cachedAlerts : PUBLIC_ALERTS), ...extraAlerts]
    : [];''')
s=s.replace('''        {/* Feed — single column on mobile, 2-col grid on tablet+ */}''','''        {!DEMO_ALERTS_ENABLED && <p role="status" className="mt-4 rounded-xl border border-amber-400/50 bg-amber-950/30 p-4 text-sm font-semibold text-amber-100">Live official alerts are not connected. An empty list does not mean your area is safe. Follow official local advisories.</p>}

        {/* Feed — single column on mobile, 2-col grid on tablet+ */}''')
s=s.replace('''            <p className="text-sm font-semibold text-white">No alerts in this view</p>''','''            <p className="text-sm font-semibold text-white">{DEMO_ALERTS_ENABLED ? "No alerts in this view" : "Alert feed unavailable"}</p>''')
s=s.replace('''              Try a different filter — or check back when a new warning is issued
              for your area.''','''              {DEMO_ALERTS_ENABLED ? "Try a different filter or check back later." : "Check official local warnings for current conditions."}''')
s=s.replace('''      <SafeStatusToggle />''','''      {DEMO_ALERTS_ENABLED && <SafeStatusToggle />}''')
p.write_text(s,encoding='utf-8')
p=Path('.env.example');s=p.read_text(encoding='utf-8')
if 'NEXT_PUBLIC_DEMO_DATA_ENABLED=' not in s:s += '\nNEXT_PUBLIC_DEMO_DATA_ENABLED=false\n'
p.write_text(s,encoding='utf-8')
