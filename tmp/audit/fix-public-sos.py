from pathlib import Path
p=Path('app/api/sos/route.ts');s=p.read_text(encoding='utf-8')
s=s.replace('message: "SOS dispatched to nearby responders.",','message: "SOS report recorded. Responder notification has not been confirmed.",\n      dispatched: false,')
a=s.index('    // Still acknowledge — citizen should not retry in panic')
b=s.index('\n  }\n}',a)
s=s[:a]+'''    return NextResponse.json({ ok: false, error: "SOS could not be recorded. Call your local emergency number now." }, { status: 503 });'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('app/(public)/sos/page.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('  const [sosId, setSosId] = useState<string | null>(null);','  const [sosId, setSosId] = useState<string | null>(null);\n  const [sosError, setSosError] = useState<string | null>(null);')
s=s.replace('    setSubmitting(true);\n    try {','    setSubmitting(true);\n    setSosError(null);\n    try {',1)
s=s.replace('''      if (data.ok) {
        setSosId(data.sosId);
        setSubmitted(true);
      }
    } catch {
      // Still show confirmation on network failure
      setSosId("offline-" + Date.now());
      setSubmitted(true);
    } finally {''','''      if (!res.ok || !data.ok) {
        setSosError(data.error ?? "SOS could not be recorded. Call your local emergency number now.");
        return;
      }
      setSosId(data.sosId);
      setSubmitted(true);
    } catch {
      setSosError("SOS could not be sent. Call your local emergency number now.");
    } finally {''')
s=s.replace('>SOS Sent</h1>','>SOS Report Recorded</h1>')
s=s.replace('Your emergency alert has been dispatched to responders in your area.','Your report was saved. Responder notification has not been confirmed.')
s=s.replace('''              Help is on the way. Stay where you are if safe to do so.
              Responders have your GPS location{isPwd ? " and PWD priority flag" : ""}.''','''              Call your local emergency number for immediate help. Keep your location available if it is safe to do so.''')
s=s.replace('''          {/* SOS Button */}''','''          {sosError && <p role="alert" className="rounded-xl border border-red-400 bg-red-950 p-3 text-sm font-semibold text-white">{sosError}</p>}

          {/* SOS Button */}''')
s=s.replace('Your location and message will be sent to nearby disaster responders.\n          {isPwd && " PWD flag ensures priority dispatch."}','Your report is recorded when the service is available. Contact emergency services directly for immediate help.')
p.write_text(s,encoding='utf-8')
