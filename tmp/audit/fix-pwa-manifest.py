from pathlib import Path
p=Path('next.config.mjs');s=p.read_text(encoding='utf-8')
needle='''  publicExcludes: ["!noprecache/**/*", "!*.apk", "!stitch-designs/**"],'''
assert needle in s
s=s.replace(needle,needle+'''
  // Workbox also receives generated manifest entries, so filter here as a
  // second guard. Native installers must remain normal downloads.
  manifestTransforms: [async (entries) => ({
    manifest: entries.filter(({ url }) => !/\\.apk(?:\\?|$)/i.test(url)),
    warnings: [],
  })],''')
p.write_text(s,encoding='utf-8')
