from pathlib import Path
p=Path('app/(dashboard)/map/page.tsx'); s=p.read_text(encoding='utf-8')
s=s.replace('import { useEffect, useState } from "react";','import { useCallback, useEffect, useState } from "react";')
s=s.replace('  const [focus, setFocus] = useState("Global");','  const [focus, setFocus] = useState("Global");\n  const handleMapFocus = useCallback(({ place, district }: { place: string | null; district: string | null }) => {\n    setFocus(place ?? district ?? "Global");\n  }, []);')
s=s.replace('onMapStateChange={({ place, district }) => setFocus(place ?? district ?? "Global")}','onMapStateChange={handleMapFocus}')
p.write_text(s,encoding='utf-8')
p=Path('components/map/DisasterMap.tsx'); s=p.read_text(encoding='utf-8')
s=s.replace('''          : conditions.source === "live"
            ? "● Live feed"
            : "● Synthetic data"}''','''          : conditions.source === "live"
            ? "● Live feed"
            : conditions.source === "synthetic"
              ? "● Synthetic data"
              : "● Data unavailable"}''')
p.write_text(s,encoding='utf-8')
