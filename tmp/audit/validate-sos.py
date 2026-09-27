from pathlib import Path
p=Path('app/api/sos/route.ts');s=p.read_text(encoding='utf-8')
s=s.replace('''  // Build rich raw_text with PWD info''','''  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ ok: false, error: "A valid location is required to record an SOS. Call your local emergency number now." }, { status: 422 });
  }

  // Build rich raw_text with PWD info''')
s=s.replace('lat: lat ?? 0,\n        lng: lng ?? 0,','lat,\n        lng,')
p.write_text(s,encoding='utf-8')
