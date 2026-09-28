"use client";

// ---------------------------------------------------------------------
// components/ui/BackButton.tsx — global "go back" affordance.
//
// Renders a ghost IconButton with an arrow-left icon that calls
// history.back(). It is disabled when there is no previous history entry.
// ---------------------------------------------------------------------

import { useHistoryBack } from "@/lib/navigation/use-history-back";
import { ArrowLeft } from "lucide-react";
import IconButton from "@/components/ui/IconButton";

export interface BackButtonProps {
  label?: string;
  className?: string;
}

export function BackButton({ label = "Go back", className = "" }: BackButtonProps) {
  const { canGoBack, goBack } = useHistoryBack();

  return (
    <IconButton
      label={label}
      size="md"
      variant="ghost"
      className={className}
      disabled={!canGoBack}
      onClick={goBack}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
    </IconButton>
  );
}

export default BackButton;
