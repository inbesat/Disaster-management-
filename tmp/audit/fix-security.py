from pathlib import Path
p=Path('middleware.ts');s=p.read_text();a=s.index('    // Whitelist of public API prefixes');b=s.index('\n  }',a);s=s[:a]+'''    const origin = request.headers.get("origin");
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    const allowed = new Set([request.nextUrl.origin, "http://localhost:3000", "https://safesphere0.netlify.app", ...(configured ? [configured.replace(/\\/$/, "")] : [])]);
    if (origin && !allowed.has(origin)) return NextResponse.json({ error: "CORS error: Origin not allowed." }, { status: 403 });
    const signedWebhook = pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/cron/") || pathname === "/api/whatsapp/inbound";
    const readOnlyPost = pathname === "/api/chat" || pathname === "/api/predict";
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !signedWebhook && !readOnlyPost) {
      const token = request.headers.get("x-csrf-token");
      const cookie = request.cookies.get("csrf_token")?.value;
      // Same-origin browser requests are protected by the Origin header;
      // clients without it must provide the double-submit token.
      if (!(origin && allowed.has(origin)) && (!token || token !== cookie)) return NextResponse.json({ error: "CSRF token mismatch or missing." }, { status: 403 });
    }
    const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
      response.headers.set("Vary", "Origin");
    }
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.headers.set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    response.headers.set("Cache-Control", "no-store");
    return response;'''+s[b:];p.write_text(s)
p=Path('next.config.mjs');s=p.read_text();s=s.replace('handler: "NetworkFirst",','handler: "NetworkOnly",',1);a=s.index('      options: {\n        cacheName: "disasterlink-api-v1"');b=s.index('\n    },',a);s=s[:a]+s[b:];s=s.replace('camera=(), microphone=(self), geolocation=(self)','camera=(self), microphone=(self), geolocation=(self)');s=s.replace('"https://safesphere.vercel.app"','"https://safesphere0.netlify.app"');s=s.replace('value: "default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; script-src * \'unsafe-inline\' \'unsafe-eval\'; style-src * \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\';"','value: "default-src \'self\'; frame-ancestors \'none\'; object-src \'none\'"');p.write_text(s)
# Offline unavailable wording is stable across all bridge consumers.
p=Path('lib/ai-bridge/ai-bridge.ts');s=p.read_text();a=s.index('      text:\n',s.index('private offlineReply'));b=s.index('      mode:',a);s=s[:a]+'''      text: "AI assistant is temporarily unavailable. For emergencies, use the SOS button or call 108. Reconnect or prepare Offline AI in Settings.",
'''+s[b:];p.write_text(s)
# Lockfile actually present is pnpm, not npm.
for p in Path('.github/workflows').glob('*.yml'):
 s=p.read_text().replace('node-version: 20','node-version: 22').replace('cache: npm','cache: pnpm').replace('      - name: Setup Node.js 20','      - uses: pnpm/action-setup@v4\n        with:\n          version: 10\n\n      - name: Setup Node.js 22').replace('npm ci','pnpm install --frozen-lockfile').replace("java-version: '17'","java-version: '21'")
 p.write_text(s)
print('Repaired API origin checks, private-response caching, camera permissions and CI package-manager mismatch.')
