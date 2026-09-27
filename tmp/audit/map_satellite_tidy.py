from pathlib import Path
p=Path('lib/config/navigation.ts')
s=p.read_text(encoding='utf-8-sig')
old='label: "Satellite & Ground Truth",\n    href: "/settings/integrations",'
assert old in s
p.write_text(s.replace(old,'label: "Satellite & Ground Truth",\n    href: "/satellite",'),encoding='utf-8')
p=Path('lib/map/place-search.ts')
s=p.read_text(encoding='utf-8')
s=s.replace('    const lat = Number(row.gps_coordinates?.latitude);\n    const lng = Number(row.gps_coordinates?.longitude);','    const rawLat = row.gps_coordinates?.latitude;\n    const rawLng = row.gps_coordinates?.longitude;\n    if (rawLat == null || rawLng == null) continue;\n    const lat = Number(rawLat);\n    const lng = Number(rawLng);')
p.write_text(s,encoding='utf-8')
for name in ('components/navigation/MoreBottomSheet.tsx','components/admin/AdminSidebar.tsx','middleware.ts'):
    p=Path(name); s=p.read_text(encoding='utf-8-sig'); p.write_text(s,encoding='utf-8')
