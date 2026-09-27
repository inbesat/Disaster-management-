from pathlib import Path
p=Path('components/public/WeatherCarousel.tsx');s=p.read_text(encoding='utf-8')
a=s.index('// ---------------------------------------------------------------------')
b=s.index('import { useEffect',a)
s=s[:a]+'''// Three-day forecast from live weather data. When unavailable, state it
// plainly instead of rendering invented conditions or zero temperatures.

'''+s[b:]
a=s.index('        if (!cancelled && cards === null) {')
b=s.index('\n      }\n    }',a)
s=s[:a]+'''        if (!cancelled) {
          setCards([]);
          setLive(false);
        }'''+s[b:]
s=s.replace('{live ? "Live · OpenWeatherMap" : "Cached forecast"}', '{live ? "Live · OpenWeatherMap" : "Unavailable"}')
s=s.replace('        {(cards ?? [null, null, null]).map((day, i) => (', '''        {cards?.length === 0 && (
          <div role="status" className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            Live forecast is unavailable. Check local weather advisories before travelling.
          </div>
        )}
        {(cards ?? [null, null, null]).map((day, i) => (''')
s=s.replace('        Swipe for the 3-day outlook','        {cards?.length ? "Swipe for the 3-day outlook" : ""}')
p.write_text(s,encoding='utf-8')
