from pathlib import Path
for name in ('components/admin/AdminSidebar.tsx','components/navigation/MoreBottomSheet.tsx','lib/config/navigation.ts','middleware.ts'):
    p=Path(name); s=p.read_text(encoding='utf-8'); p.write_text(s.rstrip()+'\n',encoding='utf-8')
