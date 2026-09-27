from pathlib import Path
p=Path('app/api/fm/coverage/route.ts');s=p.read_text(encoding='utf-8')
s=s.replace('''  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radius = Number(searchParams.get("radius")) || 50;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {''','''  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const radius = Number(searchParams.get("radius") ?? 50);

  if (!latParam || !lngParam || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(radius) || radius <= 0 || radius > 500) {''')
p.write_text(s,encoding='utf-8')
