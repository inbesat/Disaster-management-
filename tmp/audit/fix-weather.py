from pathlib import Path
import re
p=Path('app/api/weather/route.ts');s=p.read_text(encoding='utf-8')
a=s.index('/** Deterministic pseudo-random')
b=s.index('export async function GET',a)
s=s[:a]+s[b:]
s=s.replace('// No key configured — serve deterministic mock weather so map widgets\n  // keep rendering during demos (source: "mock").','// Never present invented weather as a live observation.')
s=re.sub(r'return NextResponse\.json\(\{\s*ok: true,\s*recorded: null,\s*persisted: false,\s*source: "mock",\s*weather: mockWeatherFor\(lat, lng\),\s*\}\);','return NextResponse.json({ ok: false, source: "unavailable", error: "Live weather data is unavailable" }, { status: 503 });',s)
s=s.replace('serving mock weather','weather unavailable').replace('degrade to\n    // mock weather instead of 500-ing every widget on the page.','return an unavailable status.').replace('// Network failure reaching OpenWeatherMap — degrade to mock weather\n    // rather than surfacing a 500 to every widget on the page.','// The upstream observation could not be verified.')
p.write_text(s,encoding='utf-8')
p=Path('app/api/weather/forecast/route.ts');s=p.read_text(encoding='utf-8')
a=s.index('// ---------------------------------------------------------------------')
b=s.index('export type ForecastDay',a)
s=s[:a]+'''// Three-day forecast aggregated from OpenWeatherMap. Missing upstream data
// is reported as unavailable, never replaced by plausible invented weather.

'''+s[b:]
a=s.index('function mockForecastFor')
b=s.index('/** Pick the dominant condition',a)
s=s[:a]+s[b:]
s=re.sub(r'return NextResponse\.json\(\{\s*ok: true,\s*source: "mock",\s*days: mockForecastFor\(lat, lng\),\s*\}\);','return NextResponse.json({ ok: false, source: "unavailable", days: [], error: "Live forecast is unavailable" }, { status: 503 });',s)
s=s.replace('serving mock forecast','forecast unavailable').replace('serving mock','forecast unavailable').replace('// No key — deterministic mock so demos stay offline-safe.','// Do not invent forecast data when the service is not configured.')
s=s.replace('if (!latParam || !lngParam || Number.isNaN(lat) || Number.isNaN(lng)) {','if (!latParam || !lngParam || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {')
p.write_text(s,encoding='utf-8')
