from pathlib import Path
p=Path('middleware.ts')
s=p.read_text(encoding='utf-8')
old='// Server actions POST with a \next-action` header and expect an'
assert old in s
p.write_text(s.replace(old,'// Server actions POST with a `next-action` header and expect an'),encoding='utf-8')
