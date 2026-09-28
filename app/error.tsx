"use client";

import { useEffect } from "react";
import SystemErrorFallback from "@/components/ui/SystemErrorFallback";
import { captureException } from "@/lib/monitoring/sentry";
import { attemptChunkRecovery, isChunkLoadError } from "@/lib/navigation/chunk-load-recovery";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
    void captureException(error, { source: "app/error", digest: error.digest });
  }, [error]);

  // Back can restore a document captured before the current deploy, whose
  // hashed chunk references that deploy has since deleted. Reload once onto the
  // same URL with the current build instead of stranding the user on the error
  // screen. See lib/navigation/chunk-load-recovery.ts for the loop guard.
  useEffect(() => {
    if (isChunkLoadError(error)) attemptChunkRecovery();
  }, [error]);

  return <SystemErrorFallback error={error} reset={reset} digest={error.digest} />;
}
