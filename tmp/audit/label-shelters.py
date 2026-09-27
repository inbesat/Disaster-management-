from pathlib import Path
p=Path('components/public/NearbySheltersList.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('aria-label="Nearby shelters"','aria-label="Illustrative demo shelters"').replace('>NEARBY SHELTERS</p>','>DEMO SHELTERS · UNVERIFIED</p>')
s=s.replace('''      <ul className="space-y-2.5">''','''      <p className="text-xs font-medium text-amber-200">Names, distances and bed counts are sample data. Check official local sources before travelling.</p>

      <ul className="space-y-2.5">''')
p.write_text(s,encoding='utf-8')
p=Path('components/public/lifelines/EvacuationLifelines.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('Find Nearest Safe Shelter','Explore Demo Shelter Map')
s=s.replace('''We&rsquo;ll use your live location and draw you a safe route to the
          closest open shelter on the map.''','''The map uses illustrative shelter and route data. Verify official local advisories before travelling.''')
p.write_text(s,encoding='utf-8')
