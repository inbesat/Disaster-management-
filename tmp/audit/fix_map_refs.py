from pathlib import Path
p=Path('components/map/MapPlaceSearch.tsx'); s=p.read_text(encoding='utf-8'); s=s.replace('const { current: map } = useMap();','const map = useMap().default;'); p.write_text(s,encoding='utf-8')
p=Path('components/map/LocationSelector.tsx'); s=p.read_text(encoding='utf-8'); s=s.replace('const { current: map } = useMap();','const map = useMap().default;'); p.write_text(s,encoding='utf-8')
p=Path('components/map/DisasterMap.tsx'); s=p.read_text(encoding='utf-8')
for name in ('FloodPulse','MeasureReadout','ShareAlert'):
    start=s.index('function '+name+'(')
    old='const { current: map } = useMap();'
    pos=s.index(old,start)
    s=s[:pos]+'const map = useMap().default;'+s[pos+len(old):]
p.write_text(s,encoding='utf-8')
