from pathlib import Path
p=Path('components/map/DisasterMap.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('  groundReports?: GroundReport[];\n};','  groundReports?: GroundReport[];\n  /** Leave room for the full-screen map header. */\n  searchBelowHeader?: boolean;\n};',1)
s=s.replace('  groundReports = [],\n}: DisasterMapProps)', '  groundReports = [],\n  searchBelowHeader = false,\n}: DisasterMapProps)',1)
s=s.replace('''      <div className="pointer-events-none absolute right-4 top-4 z-20 w-[min(24rem,calc(100%-2rem))] space-y-2">''','''      <div className={`pointer-events-none absolute right-4 z-20 w-[min(24rem,calc(100%-2rem))] space-y-2 ${searchBelowHeader ? "top-20" : "top-4"}`}>''',1)
p.write_text(s,encoding='utf-8')
p=Path('app/(dashboard)/map/page.tsx')
s=p.read_text(encoding='utf-8')
s=s.replace('import InfoDrawer, { type InfoFeature } from "@/components/map/InfoDrawer";\n','')
start=s.index('/** Demo selection so the drawer is visible straight away')
end=s.index('export default function MapPage()',start)
s=s[:start]+s[end:]
s=s.replace('  const [selected, setSelected] = useState<InfoFeature | null>(MOCK_SELECTED);\n','')
s=s.replace('  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);','  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);\n  const [focus, setFocus] = useState("Global");')
s=s.replace('''        <MapHeader
          isFullscreen={false}''','''        <MapHeader
          title={`${focus} Map Operations`}
          isFullscreen={false}''')
s=s.replace('''          disasterType="flood"
        />''','''          disasterType="flood"
          searchBelowHeader
          onMapStateChange={({ place, district }) => setFocus(place ?? district ?? "Global")}
        />''',1)
s=s.replace('className="absolute right-3 top-[60px] z-10"','className="absolute right-3 top-[190px] z-10 sm:left-3 sm:right-auto sm:top-20"')
s=s.replace('          <InfoDrawer feature={selected} onClose={() => setSelected(null)} />\n','')
p.write_text(s,encoding='utf-8')
