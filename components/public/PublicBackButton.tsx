"use client";

import { useHistoryBack } from "@/lib/navigation/use-history-back";
import { ArrowLeft } from "lucide-react";

export default function PublicBackButton({ className = "" }: { className?: string }) {
  const { canGoBack, goBack } = useHistoryBack();

  return (
    <button
      type="button"
      disabled={!canGoBack}
      onClick={goBack}
      className={`absolute left-4 top-4 z-50 flex items-center gap-2 rounded-full bg-[rgba(11,31,58,0.6)] px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-all hover:bg-[rgba(11,31,58,0.8)] sm:left-6 sm:top-6 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
