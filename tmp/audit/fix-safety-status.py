from pathlib import Path
p=Path('components/public/SafetyOverview.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('import { useSafetyStatus } from "@/hooks/useSafetyStatus";','import { useSafetyStatus } from "@/hooks/useSafetyStatus";\nimport { TriangleAlert } from "lucide-react";')
s=s.replace('export function SafetyOverview() {','export function SafetyOverview({ demoDataEnabled = false }: { demoDataEnabled?: boolean }) {')
s=s.replace('''  return (
    <div className="space-y-4">
      <SafetyHero status={status} area={area} updatedAt={updatedAt} />
      <ActionCard status={status} />
      <WeatherCarousel />
    </div>
  );''','''  return (
    <div className="space-y-4">
      {demoDataEnabled ? (
        <>
          <p role="status" className="rounded-xl border border-amber-400/50 bg-amber-950/40 p-3 text-sm font-semibold text-amber-100">Demo hazard status based on sample zones; not an official warning.</p>
          <SafetyHero status={status} area={area} updatedAt={updatedAt} />
          <ActionCard status={status} />
        </>
      ) : (
        <section role="status" aria-label="Safety status unverified" className="flex min-h-[35vh] flex-col justify-center rounded-[2rem] border border-amber-400/50 bg-gradient-to-br from-amber-900/30 to-[#0a0f1a] p-6 text-white">
          <TriangleAlert aria-hidden="true" className="h-10 w-10 text-amber-300" />
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-amber-200">Current status · Unverified</p>
          <h2 className="mt-2 text-3xl font-black">Safety status unavailable</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">Live local hazard information is not connected. This app cannot confirm that your area is safe. Follow official local alerts and emergency instructions.</p>
        </section>
      )}
      <WeatherCarousel />
    </div>
  );''')
p.write_text(s,encoding='utf-8')
p=Path('app/public/dashboard/page.tsx');s=p.read_text(encoding='utf-8').replace('<SafetyOverview />','<SafetyOverview demoDataEnabled={process.env.DEMO_DATA_ENABLED === "true"} />');p.write_text(s,encoding='utf-8')
