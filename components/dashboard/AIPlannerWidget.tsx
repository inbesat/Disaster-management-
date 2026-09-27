import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import Panel from "@/components/ui/Panel";

export default function AIPlannerWidget() {
  return (
    <Panel
      className="glow-purple-soft"
      title={
        <span className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-400" /> AI Commander Advice
        </span>
      }
    >
      <p className="text-sm leading-relaxed text-slate-300">
        Generate a response plan using the AI planner. Check its live data and sources
        before approving any action.
      </p>
      <Link
        href="/ai-planner"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
      >
        Open AI Planner <ArrowRight className="h-4 w-4" />
      </Link>
    </Panel>
  );
}
