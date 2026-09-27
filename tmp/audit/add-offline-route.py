from pathlib import Path
p=Path('next.config.mjs');s=p.read_text(encoding='utf-8')
needle='  runtimeCaching: [\n'
repl='''  runtimeCaching: [
    {
      // Cache only public pages. Private dashboards must never be served from
      // another user's browser cache after a sign-out or account switch.
      urlPattern: ({ url, request }) =>
        url.origin === self.location.origin &&
        request.mode === "navigate" &&
        /^\\/public(?:\\/|$)/.test(url.pathname),
      handler: "NetworkFirst",
      options: {
        cacheName: "disasterlink-public-pages-v1",
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
'''
assert needle in s
s=s.replace(needle,repl,1)
p.write_text(s,encoding='utf-8')
