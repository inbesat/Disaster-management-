/** @type {import('next').NextConfig} */

// Phase 13 · Step 1 — PWA. next-pwa generates a workbox service worker
// into public/ that precaches the app, applies runtime caching and serves
// the /~offline page for offline navigations (fallbacks.document). The
// web-push + offline-shell handlers live in worker/index.js and are
// bundled into the generated worker via customWorkerDir (they no-op when
// workbox is present, so there is no respondWith conflict).
//
// The wrapper is applied ONLY outside development. Skipping it in dev
// means next-pwa never loads, so it stops printing its misleading
// "[PWA] PWA support is disabled" notice (twice per compile — node +
// edge) and adds zero webpack overhead during `next dev`. The service
// worker is still built on `next build` and registered client-side in
// production (components/pwa/ServiceWorkerRegister.tsx).
import withPWAInit from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
  register: false,
  customWorkerDir: "worker",
  // APK downloads and design reference files are not part of the offline web shell.
  // Precaching the 77 MB native APK can make first-time worker installation fail.
  publicExcludes: ["!noprecache/**/*", "!*.apk", "!stitch-designs/**"],
  // Next includes this manifest in the build output, but next start does not serve it.
  // Precache installation must not fail on that 404.
  buildExcludes: [/app-build-manifest\.json$/],
  // Workbox also receives generated manifest entries, so filter here as a
  // second guard. Native installers must remain normal downloads.
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.filter(({ url }) =>
        !/\.apk(?:\?|$)/i.test(url) && !/\/app-build-manifest\.json$/i.test(url),
      ),
      warnings: [],
    }),
  ],
  fallbacks: { document: "/~offline" },
  // Phase 7 · Step 1 — sw.js cache strategies. Workbox owns these routes in
  // the generated public/sw.js:
  //   • API calls — network-first, with a short timeout so slow/absent
  //     backend fails fast into the offline cache (or the page's IndexedDB
  //     fallback, which the offline-sync engine owns).
  //   • Static assets — cache-first (never blocked by the network).
  //   • Map tiles + icons — cache-first with a larger timeout.
  runtimeCaching: [
    {
      // Cache only public pages. Private dashboards must never be served from
      // another user's browser cache after a sign-out or account switch.
      urlPattern: ({ url, request }) =>
        url.origin === self.location.origin &&
        request.mode === "navigate" &&
        /^\/public(?:\/|$)/.test(url.pathname),
      handler: "NetworkFirst",
      options: {
        cacheName: "disasterlink-public-pages-v1",
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
      method: "GET",
      options: {},
    },
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        /\.(png|jpg|jpeg|svg|webp|css|js|woff2?)$/.test(url.pathname),
      handler: "CacheFirst",
      method: "GET",
      options: {
        cacheName: "disasterlink-static-v1",
        expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        /\.(png|jpe?g)$/.test(url.pathname) &&
        url.pathname.includes("tile"),
      handler: "CacheFirst",
      method: "GET",
      options: {
        cacheName: "disasterlink-tiles-v1",
        expiration: { maxEntries: 800, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
  ],
});

// Phase 24 · CORS lockdown.
//
// Allow list resolution order:
//   1. NEXT_PUBLIC_SITE_URL           — set this to your production origin
//   2. VERCEL_PROJECT_PRODUCTION_URL  — auto-injected by Vercel on deploy
//   3. "*"                            — hackathon fallback (open CORS)
//
// When a concrete origin is used, `Access-Control-Allow-Credentials: true`
// is also emitted so cookie/session auth can work cross-origin. When the
// value is "*", that header is omitted — browsers reject "*" + credentials.
const envOrigin =
  process.env.ALLOWED_ORIGIN ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL;

const allowedOrigin =
  envOrigin && envOrigin !== "*"
    ? envOrigin
    : isDev
      ? "http://localhost:3000"
      : "https://safesphere0.netlify.app";

const nextConfig = {
  // Require compiler validation for releases
  typescript: {
    ignoreBuildErrors: false,
  },
  // Require lint validation for releases
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Remote image hosts the app renders via next/image (QR codes are generated
  // on-demand by qrserver.com; donate flows embed them). Landing section
  // photography comes from Unsplash. Local + PWA assets need no config.
  // NOTE: adding hosts here requires a dev-server restart.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PATCH, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-CSRF-Token",
          },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Cache preflight responses for a day to cut redundant OPTIONS calls.
          { key: "Access-Control-Max-Age", value: "86400" },
          // Caches must vary on Origin when CORS headers depend on the
          // request's Origin — otherwise a shared cache can replay one
          // origin's ACAO to another.
          { key: "Vary", value: "Origin" },
          // Security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Hackathon CSP: completely permissive so Maps, Translate, etc work
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
          },
        ],
      },
      {
        // APK download — force browser download with the Android MIME type
        // instead of trying to render/parse the binary. Covers the new
        // /safesphere.apk location (download hub) and the legacy /apk/ path.
        source: "/safesphere.apk",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          { key: "Content-Disposition", value: "attachment" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
      {
        source: "/apk/:path*",
        headers: [
          {
            key: "Content-Type",
            value: "application/vnd.android.package-archive",
          },
          { key: "Content-Disposition", value: "attachment" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Security headers for all pages
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

// Skip the PWA plugin entirely in dev (fast cold starts, no misleading
// "[PWA] PWA support is disabled" log). Production keeps the service
// worker as before.
export default isDev ? nextConfig : withPWA(nextConfig);
