from pathlib import Path
p=Path('components/field/SosPanicModal.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('PATNA_CENTER, OfflineSyncQueue','OfflineSyncQueue')
s=s.replace('setCoords(PATNA_CENTER);','setCoords(null);')
s=s.replace('  const [broadcast, setBroadcast] = useState(false);','  const [broadcast, setBroadcast] = useState(false);\n  const [dispatchError, setDispatchError] = useState<string | null>(null);')
a=s.index('  async function dispatch() {')
b=s.index('\n  function close()',a)
s=s[:a]+'''  async function dispatch() {
    setDispatchError(null);
    if (!coords) {
      setDispatchError("GPS is unavailable. Contact the control room directly and share your location.");
      return;
    }
    const payload: SosPayload = {
      type: "SOS_EMERGENCY",
      responder: RESPONDER_NAME,
      lat: coords.lat,
      lng: coords.lng,
      at: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/field/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setDispatchError("SOS was not recorded. Contact the control room directly.");
        return;
      }
      setBroadcast(true);
      setCoords(null);
      setOpen(false);
    } catch {
      if (!navigator.onLine) {
        OfflineSyncQueue.enqueue({ url: "/api/field/sos", method: "POST", body: payload });
        setDispatchError("SOS is queued on this device, not delivered. Contact the control room directly.");
      } else {
        setDispatchError("SOS could not be sent. Contact the control room directly.");
      }
    }
  }
'''+s[b:]
s=s.replace('EMERGENCY SIGNAL BROADCASTED. CONTROL ROOM &amp; NEARBY UNITS\n            NOTIFIED.','SOS REPORT RECORDED. RESPONDER NOTIFICATION IS UNCONFIRMED.')
s=s.replace('This broadcasts your location to the District Control Room now.','This records an SOS report. Contact the control room directly for immediate help.')
s=s.replace('''            {/* Hold-to-confirm (accidental trigger protection) */}''','''            {dispatchError && <p role="alert" className="mt-4 rounded-lg border border-red-400 bg-red-950 p-3 text-sm font-bold text-white">{dispatchError}</p>}

            {/* Hold-to-confirm (accidental trigger protection) */}''')
p.write_text(s,encoding='utf-8')
