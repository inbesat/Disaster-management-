from pathlib import Path
p=Path('components/public/NovaChat.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('import { writeTrappedStatus } from "@/lib/mock-data/public-alerts";\n','')
s=s.replace('  "I am alerting the control room now. Stay calm. I\'ve shared your live location and marked you as needing rescue — help is on the way.";','  "I can help you send an SOS. Confirm the request in the emergency form that just opened. Nothing has been sent yet; call emergency services if you are in immediate danger.";')
s=s.replace('  const { activateEmergency, startSharingLocation } = useSOS();','  const { open: openSOS } = useSOS();')
s=s.replace('  const sosTriggeredRef = useRef(false);\n','')
a=s.index('    if (sosTriggeredRef.current) return;')
b=s.index('  };',a)
s=s[:a]+'''    openSOS();
    showToast("warning", {
      title: "Confirm your SOS",
      description: "The request has not been sent yet. Call emergency services if in immediate danger.",
    });
'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('components/public/sos/SOSModal.tsx');s=p.read_text(encoding='utf-8').replace('  const { isOpen, close, activateEmergency, startSharingLocation } = useSOS();','  const { isOpen, close, activateEmergency } = useSOS();').replace('        startSharingLocation();\n','');p.write_text(s,encoding='utf-8')
p=Path('app/public/layout.tsx');s=p.read_text(encoding='utf-8').replace('import LocationTracker from "@/components/public/sos/LocationTracker";\n','').replace('        <LocationTracker />\n','');p.write_text(s,encoding='utf-8')
p=Path('components/public/sos/SOSCountdown.tsx');s=p.read_text(encoding='utf-8').replace('A rescue team is about to be dispatched to your saved location.','Your request will be sent with your current location. Dispatch is not confirmed.');p.write_text(s,encoding='utf-8')
p=Path('components/public/sos/EmergencyModeBanner.tsx');s=p.read_text(encoding='utf-8').replace('Emergency Mode Active: Help is on the way.','SOS report recorded. Dispatch is unconfirmed.');p.write_text(s,encoding='utf-8')
p=Path('components/public/SafeStatusToggle.tsx');s=p.read_text(encoding='utf-8')
a=s.index('// ---------------------------------------------------------------------');b=s.index('export function SafeStatusToggle()',a)
s=s[:a]+'''import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { triggerLightHaptic } from "@/hooks/useHaptics";
import { readSafeStatus, writeSafeStatus } from "@/lib/mock-data/public-alerts";

'''+s[b:]
s=s.replace('  const [status, setStatus] = useState<StatusState>("idle");\n  const timerRef = useRef<number | null>(null);','  const [status, setStatus] = useState<"idle" | "safe">("idle");')
s=s.replace('    return () => {\n      if (timerRef.current !== null) window.clearTimeout(timerRef.current);\n    };\n','')
a=s.index('  const markSafe = () => {');b=s.index('  return (',a)
s=s[:a]+'''  const markSafe = () => {
    if (status !== "idle") return;
    writeSafeStatus();
    setStatus("safe");
    triggerLightHaptic();
    showToast("info", {
      title: "Marked safe on this device",
      description: "Family notification is not connected. Contact your family directly.",
    });
  };

'''+s[b:]
s=s.replace('      disabled={status === "loading"}\n','').replace('} ${status === "loading" ? "cursor-wait opacity-80" : ""}`}','}`}')
a=s.index('      {status === "loading" ? (');b=s.index('    </button>',a)
s=s[:a]+'''      {status === "safe" ? (
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
      ) : (
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
      )}
      {status === "safe" ? "Marked Safe (this device)" : "Mark Myself Safe"}
'''+s[b:]
p.write_text(s,encoding='utf-8')
