"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ChatInterface from "@/components/ai/ChatInterface";
import { PUBLIC_DISTRICTS, savedPublicLocation, locationSchema, type PublicLocation } from "@/lib/public-safety/location";
import type { HouseholdPlan, HouseholdDraft } from "@/lib/public-safety/plan";

const sections: Array<{ key: keyof Pick<HouseholdDraft, "immediateActions" | "next24Hours" | "next48Hours" | "packing" | "routeChecks" | "medicalAndAccessibility" | "familyCommunication" | "missingInformation">; title: string }> = [
  { key: "immediateActions", title: "Do now" }, { key: "next24Hours", title: "Next 24 hours" },
  { key: "next48Hours", title: "Next 48 hours" }, { key: "packing", title: "Packing checklist" },
  { key: "routeChecks", title: "Travel and evacuation checks" },
  { key: "medicalAndAccessibility", title: "Medical and accessibility needs" },
  { key: "familyCommunication", title: "Family communication" },
  { key: "missingInformation", title: "Confirm before acting" },
];

export default function HouseholdPlanner({ initialQuestion = "Create my complete household flood preparedness plan.", initialDistrict }: { initialQuestion?: string; initialDistrict?: string }) {
  const [location, setLocation] = useState<PublicLocation>({ district: "Patna" });
  const [people, setPeople] = useState(4);
  const [needs, setNeeds] = useState("");
  const [destination, setDestination] = useState("");
  const [question, setQuestion] = useState(initialQuestion);
  const [plan, setPlan] = useState<HouseholdPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const requested = locationSchema.safeParse({ district: initialDistrict });
    const saved = savedPublicLocation();
    setLocation(requested.success ? saved?.district === requested.data.district ? saved : requested.data : saved ?? { district: "Patna" });
    return () => controllerRef.current?.abort();
  }, [initialDistrict]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setError(""); setPlan(null);
    try {
      const response = await fetch("/api/public/plan", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, people, needs, destination, question }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Plan generation failed. Please retry.");
      if (!controller.signal.aborted) { setPlan(body); requestAnimationFrame(() => resultRef.current?.focus()); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to generate the plan. Please retry.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function download() {
    if (!plan) return;
    const text = [`SafeSphere household safety plan · ${plan.generatedAt}`, `Risk signals: ${plan.risk}`, plan.draft.summary,
      `Three-day supplies: ${plan.supplies.waterLitres} litres emergency water; ${plan.supplies.foodPersonDays} person-days of food.`,
      ...sections.map(({ key, title }) => `${title}\n${plan.draft[key].map((item) => `- ${item}`).join("\n")}`),
      `Shelter records (confirm before travel): ${plan.shelters.map((shelter) => shelter.name).join(", ") || "None validated"}`,
      plan.communication].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "SafeSphere-household-plan.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="mt-5 space-y-6">
    <form onSubmit={generate} onChange={() => setPlan(null)} className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/70 p-5 print:hidden">
      <h2 className="text-xl font-bold">Build your complete safety plan</h2>
      <p className="text-sm text-slate-300">The assistant checks local risk signals, drafts your plan, calculates supplies and validates shelter references. Your details are sent to the configured AI provider to generate this plan; avoid names or private medical records.</p>
      <fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Plan location<select aria-label="Plan location" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" value={location.district} onChange={(event) => { setLocation({ district: event.target.value as PublicLocation["district"] }); setPlan(null); }}>
          {Object.keys(PUBLIC_DISTRICTS).map((district) => <option key={district}>{district}</option>)}
        </select></label>
        <label className="text-sm">People in household<input type="number" min={1} max={30} required value={people} onChange={(event) => setPeople(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" /></label>
      </div>
      {location.lat !== undefined && <p className="text-xs text-sky-200">Using saved GPS coordinates {location.lat.toFixed(3)}, {location.lng?.toFixed(3)} for weather and nearby reports.</p>}
      <label className="block text-sm">Household needs<textarea rows={2} maxLength={1200} value={needs} onChange={(event) => setNeeds(event.target.value)} placeholder="Children, older adults, mobility needs, medicines, pets, available transport…" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Planned destination or route (optional)<input maxLength={250} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Area or destination you want to reach" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" /></label>
      <label className="block text-sm">What should your plan address?<textarea rows={2} maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3" /></label>
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">{busy ? "Checking data and building your plan…" : "Generate complete plan"}</button></fieldset>
      <p role="status" className="text-sm text-slate-300">{busy ? "Assessing risk → planning → calculating supplies → validating. This can take up to a minute." : "This draft helps you prepare. Follow official local emergency instructions."}</p>
      {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
    </form>
    {plan && <section ref={resultRef} tabIndex={-1} aria-label="Your household safety plan" className="space-y-5 rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-5 outline-none">
      <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">Your household safety plan</h2><span className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200">Draft · {plan.risk} signals</span></div>
      <p className="leading-relaxed text-slate-200">{plan.draft.summary}</p>
      <p className="text-xs text-slate-300">Generated {new Date(plan.generatedAt).toLocaleString("en-IN")}. Weather {plan.availability.weather ? "connected" : "unavailable"}; verified reports {plan.availability.verifiedReports ? "connected" : "unavailable"}; shelter feed {plan.availability.shelters ? "connected" : "unavailable"}.</p>
      <div className="rounded-xl border border-sky-400/30 bg-sky-950/30 p-4"><h3 className="font-bold">Three-day household supplies</h3><p className="mt-2">{plan.supplies.waterLitres} litres of emergency water · {plan.supplies.foodPersonDays} person-days of food for {plan.supplies.people} people.</p><p className="mt-1 text-xs text-slate-300">Planning baseline: 4 litres per person per day for drinking and basic sanitation, rounded up from CDC guidance. Store more for heat and medical needs.</p><a className="text-xs text-cyan-300 underline" href="https://www.cdc.gov/water-emergency/about/how-to-create-and-store-an-emergency-water-supply.html" target="_blank" rel="noreferrer">Emergency water guidance</a></div>
      {sections.map(({ key, title }) => <section key={key}><h3 className="font-bold text-sky-200">{title}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-200">{plan.draft[key].map((item, i) => <li key={i}>{item}</li>)}</ul></section>)}
      <section><h3 className="font-bold text-sky-200">Shelter options to confirm</h3>{plan.shelters.length ? plan.shelters.map((shelter) => <p className="mt-2 text-sm" key={shelter.id}>{shelter.name} · {shelter.availableBeds} recorded free beds · updated {new Date(shelter.updatedAt).toLocaleString("en-IN")}. Confirm current capacity before travel.</p>) : <p className="mt-2 text-sm text-slate-300">No destination could be validated from the available records. Contact local authorities for an open shelter.</p>}<Link href="/public/shelters" className="mt-2 inline-block text-sm text-cyan-300 underline">Check shelter directory</Link></section>
      <p className="rounded-xl border border-amber-400/30 p-3 text-sm text-amber-200">{plan.communication}</p>
      <details className="text-xs text-slate-300"><summary className="cursor-pointer">How this plan was built</summary><ul className="mt-2 space-y-2">{plan.stages.map((stage) => <li key={stage}>{stage}</li>)}</ul></details>
      <div className="flex flex-wrap gap-3 print:hidden"><button type="button" onClick={download} className="rounded-lg border border-white/20 px-4 py-2">Download plan</button><button type="button" onClick={() => window.print()} className="rounded-lg border border-white/20 px-4 py-2">Print plan</button></div>
    </section>}
    <details className="rounded-2xl border border-white/15 p-4 print:hidden"><summary className="cursor-pointer font-semibold">Ask a follow-up question</summary><div className="mt-4 h-[550px]"><ChatInterface district={location.district} /></div></details>
  </div>;
}

