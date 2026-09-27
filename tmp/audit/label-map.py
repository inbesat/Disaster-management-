from pathlib import Path
p=Path('app/public/map/page.tsx');s=p.read_text(encoding='utf-8')
needle='''      <OfflineMapBadge />'''
assert needle in s
s=s.replace(needle,'''      <OfflineMapBadge />
      <div role="status" className="pointer-events-none absolute inset-x-3 top-24 z-30 mx-auto max-w-lg rounded-lg border border-amber-400/60 bg-slate-950/95 px-3 py-2 text-center text-xs font-semibold text-amber-100 shadow-lg">
        Demo map: shelter, road closure, flood and route layers are illustrative. Verify local advisories before travelling.
      </div>''',1)
p.write_text(s,encoding='utf-8')
