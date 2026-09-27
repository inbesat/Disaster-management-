"use client";

// Public SOS modal state and a local marker for reports recorded by the server.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearSosActive,
  readSosActive,
  writeSosActive,
} from "@/lib/mock-data/public-alerts";

type SOSContextValue = {
  /** True while the SOS modal is on screen. */
  isOpen: boolean;
  /** Open the SOS modal from anywhere (BottomNav SOS tab, shortcuts…). */
  open: () => void;
  /** Close it (X, swipe-down, backdrop, Escape). */
  close: () => void;
  /** True while Emergency Mode is active (red banner + nav lock). */
  emergency: boolean;
  /** Confirm a rescue/medical SOS → enter (and persist) Emergency Mode. */
  activateEmergency: () => void;
  /** Cancel an active SOS from the banner (hold-to-cancel). */
  cancelEmergency: () => void;
  /** True while live GPS is being shared (Step 5 tracker) — started by
   * the SOS modal's Share Location action, or implied by Emergency Mode. */
  sharingLocation: boolean;
  /** Begin the live-location sharing session (Step 5). */
  startSharingLocation: () => void;
  /** End the sharing session early (only when no SOS is active). */
  stopSharingLocation: () => void;
};

const SOSContext = createContext<SOSContextValue | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);

  // Hydration-safe: read the persisted active-SOS flag after mount so a
  // reload mid-emergency keeps the banner (and it can never flash during
  // hydration, since the server also starts false).
  useEffect(() => {
    if (readSosActive()) setEmergency(true);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const activateEmergency = useCallback(() => {
    writeSosActive();
    setEmergency(true);
  }, []);

  const cancelEmergency = useCallback(() => {
    clearSosActive();
    setEmergency(false);
  }, []);

  const startSharingLocation = useCallback(() => setSharingLocation(true), []);
  const stopSharingLocation = useCallback(() => setSharingLocation(false), []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      emergency,
      activateEmergency,
      cancelEmergency,
      sharingLocation,
      startSharingLocation,
      stopSharingLocation,
    }),
    [
      isOpen,
      open,
      close,
      emergency,
      activateEmergency,
      cancelEmergency,
      sharingLocation,
      startSharingLocation,
      stopSharingLocation,
    ],
  );

  return <SOSContext.Provider value={value}>{children}</SOSContext.Provider>;
}

/** Access the global SOS state. Throws outside SOSProvider. */
export function useSOS(): SOSContextValue {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error("useSOS must be used within an SOSProvider");
  return ctx;
}
