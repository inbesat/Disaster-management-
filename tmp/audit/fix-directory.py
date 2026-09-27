from pathlib import Path
p=Path('app/public/shelters/page.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('Nearby Shelters & Help Centers','Illustrative Shelters & Help Centers')
s=s.replace('Your quick-reference guide to the nearest safe shelters, NDRF units, hospitals, police stations, and fire stations. All distances and occupancy are live estimates.','These listings are sample data. Distances, occupancy, operating status and contact details are unverified. Check official local sources before travelling or calling.')
s=s.replace('Open Evacuation Map — Turn-by-Turn Navigation','Open Illustrative Map')
p.write_text(s,encoding='utf-8')
p=Path('components/public/CenterDirectory.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('Map as MapIcon, Phone, X','Map as MapIcon, X')
s=s.replace('Nearby Help Centers</h2>','Demo Help Centers</h2>')
s=s.replace('''      {/* Filter chips */}''','''      <p role="status" className="mt-3 text-xs font-semibold text-amber-200">Sample locations, hours, status and phone numbers are unverified. Use official local directories for emergency contact.</p>

      {/* Filter chips */}''')
a=s.index('''            <a
              key={center.id}
              href={centerDirectionsUrl(center)}''')
b=s.index('''            </a>''',a)+len('''            </a>''')
s=s[:a]+'''            <span
              key={center.id}
              title={`${center.name} — sample location`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="block text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                {CENTER_TYPE_EMOJI[center.type]}
              </span>
            </span>'''+s[b:]
s=s.replace('{overloaded ? "Overloaded" : "Open"}','{overloaded ? "Sample: Overloaded" : "Sample: Open"}')
a=s.index('''      {/* Massive One-Tap Call */}''')
b=s.index('''    </li>''',a)
s=s[:a]+'''      <span className="rounded-lg border border-amber-400/40 px-2 py-1 text-[0.625rem] font-bold uppercase text-amber-200">Unverified</span>
'''+s[b:]
a=s.index('\nfunction centerDirectionsUrl(')
s=s[:a]+'\n'
p.write_text(s,encoding='utf-8')
