from pathlib import Path
p=Path('components/public/sos/SOSModal.tsx')
s=p.read_text(encoding='utf-8')
a=s.index('// ---------------------------------------------------------------------')
b=s.index('import { useCallback',a)
s=s[:a]+'// Citizen SOS actions. A report is acknowledged only after the server records it.\n\n'+s[b:]
s=s.replace('useCallback, useEffect, useRef, useState','useCallback, useEffect, useRef, useState')
s=s.replace('import { resolveCitizenMapView } from "@/lib/map/citizen-view";\n','')
s=s.replace('/** How long the mock "sending" spinner runs before the confirmation toast. */\nconst SUBMIT_MS = 900;\n\n','')
s=s.replace('  const timerRef = useRef<number | null>(null);\n','')
s=s.replace('      // Closing mid-submission cancels the pending mock broadcast.\n      if (timerRef.current !== null) {\n        window.clearTimeout(timerRef.current);\n        timerRef.current = null;\n      }\n','')
s=s.replace('  // Clear any in-flight mock submission on unmount.\n  useEffect(\n    () => () => {\n      if (timerRef.current !== null) window.clearTimeout(timerRef.current);\n    },\n    [],\n  );\n\n','')
a=s.index('  /** Mock submission for the amber request tile')
b=s.index('  const handleAction =',a)
s=s[:a]+'''  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number }> => {
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          }),
        );
        return { lat: position.coords.latitude, lng: position.coords.longitude };
      } catch {
        // A recently saved GPS fix can still locate a caller when permission or signal fails.
      }
    }
    const saved = readCitizenLocation();
    if (
      saved?.type === "gps" &&
      Number.isFinite(saved.lat) &&
      Number.isFinite(saved.lng) &&
      Date.now() - Date.parse(saved.savedAt) <= 30 * 60 * 1000
    ) {
      return { lat: saved.lat, lng: saved.lng };
    }
    throw new Error("Location unavailable. Call your local emergency number now.");
  }, []);

  const submitReport = useCallback(
    async (kind: "rescue" | "medical" | "food") => {
      if (busy) return;
      setBusy(kind);
      triggerLightHaptic();
      try {
        const location = await getLocation();
        const message =
          kind === "medical"
            ? "SOS — Medical emergency"
            : kind === "food"
              ? "Urgent food and water assistance requested"
              : "SOS — Rescue assistance needed";
        const response = await fetch("/api/sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...location, message, requestType: kind }),
        });
        const result = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) throw new Error(result.error || "Request not recorded.");
        if (kind !== "food") {
          activateEmergency();
          triggerHeavyHaptic();
        }
        close();
        showToast("success", {
          title: kind === "food" ? "Food/water report recorded" : "SOS report recorded",
          description: "Responder notification has not been confirmed. Call emergency services if in immediate danger.",
        });
      } catch (error) {
        showToast("error", {
          title: "Request not recorded",
          description: error instanceof Error ? error.message : "Call your local emergency number now.",
        });
      } finally {
        setBusy(null);
      }
    },
    [activateEmergency, busy, close, getLocation],
  );

  const completeCountdown = useCallback(() => {
    const kind = pendingAction;
    setPendingAction(null);
    if (kind) void submitReport(kind);
  }, [pendingAction, submitReport]);

  const shareLocation = async () => {
    try {
      const { lat, lng } = await getLocation();
      const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const text = `My current emergency location: ${coords}.`;
      if (navigator.share) {
        await navigator.share({ title: "My location", text });
        showToast("success", { title: "Location shared", description: coords });
        startSharingLocation();
      } else {
        await navigator.clipboard.writeText(coords);
        showToast("success", { title: "Location copied", description: "Paste it into a message to share." });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast("error", {
        title: "Location not shared",
        description: error instanceof Error ? error.message : "Location access is unavailable.",
      });
    }
  };

  const markSafe = () => {
    writeSafeStatus();
    triggerLightHaptic();
    showToast("info", {
      title: "Marked safe on this device",
      description: "Family notification is not connected. Contact your family directly.",
    });
  };

'''+s[b:]
s=s.replace('        submitRequest("food", "Food/water request sent");','        void submitReport("food");')
s=s.replace('                  Your SOS includes your saved location. Help is on the way.','                  A request is recorded only after server confirmation. Call emergency services if in immediate danger.')
p.write_text(s,encoding='utf-8')
p=Path('app/api/sos/route.ts')
s=p.read_text(encoding='utf-8')
s=s.replace('  const message =\n    typeof body.message === "string" ? body.message : "SOS — Emergency assistance needed";','  const message =\n    typeof body.message === "string" ? body.message.slice(0, 2000) : "SOS — Emergency assistance needed";\n  const requestType = body.requestType === "food" ? "food" : "rescue";')
s=s.replace('        reportType: "rescue",','        reportType: requestType === "food" ? "shelter_needed" : "rescue",')
p.write_text(s,encoding='utf-8')
