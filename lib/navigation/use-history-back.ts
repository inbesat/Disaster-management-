"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Back follows the real history cursor, never a hardcoded dashboard route. */
export function useHistoryBack() {
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  function goBack() {
    if (window.history.length > 1) window.history.back();
  }
  return { canGoBack, goBack };
}
