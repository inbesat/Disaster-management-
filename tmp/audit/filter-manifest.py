from pathlib import Path
p=Path('next.config.mjs');s=p.read_text(encoding='utf-8');s=s.replace('manifest: entries.filter(({ url }) => !/\\.apk(?:\\?|$)/i.test(url)),','manifest: entries.filter(({ url }) =>\n        !/\\.apk(?:\\?|$)/i.test(url) && !/\\/app-build-manifest\\.json$/i.test(url),\n      ),');p.write_text(s,encoding='utf-8')
