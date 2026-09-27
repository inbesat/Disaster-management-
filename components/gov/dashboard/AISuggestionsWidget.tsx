import Link from "next/link";
import { Brain, FileText, Sparkles } from "lucide-react";

export function AISuggestionsWidget() {
  return (
    <section className="relative flex flex-col rounded-xl border border-purple-400/50 border-l-4 border-l-purple-400 bg-[#111827] p-5 shadow-[0_0_28px_rgba(192,132,252,0.18)]">
      <div className="flex items-center gap-2 text-purple-300">
        <Sparkles className="h-5 w-5" />
        <h2 className="text-xs font-bold uppercase tracking-widest">AI planner</h2>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-200">
        Ask the planner about current reports, shelters and evacuation options. Review its
        sources before taking action.
      </p>
      <Link
        href="/gov/ai-planner"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-purple-400/50 bg-purple-500/20 px-4 py-2.5 text-sm font-bold text-purple-200 hover:bg-purple-500/30"
      >
        <FileText className="h-4 w-4" /> Open AI Planner
      </Link>
    </section>
  );
}

export function AISuggestionsEmptyState() {
  return (
    <section className="rounded-xl border border-purple-400/30 bg-[#111827] p-8 text-center">
      <Brain className="mx-auto h-8 w-8 text-purple-400" />
      <p className="mt-3 text-sm text-slate-300">No suggestions have been generated.</p>
    </section>
  );
}

export default AISuggestionsWidget;
