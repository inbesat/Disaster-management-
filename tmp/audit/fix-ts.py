from pathlib import Path
for name in ['components/field/ResponderSOS.tsx','components/field/SosPanicModal.tsx']:
 p=Path(name);s=p.read_text(encoding='utf-8').replace('setCoords(PATNA_CENTER)','setCoords(null)');p.write_text(s,encoding='utf-8')
p=Path('lib/reports/missing-store.ts');s=p.read_text(encoding='utf-8').replace('[...store.values()].sort(', 'Array.from(store.values()).sort(');p.write_text(s,encoding='utf-8')
