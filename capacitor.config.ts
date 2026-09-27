import type { CapacitorConfig } from "@capacitor/cli";

// ---------------------------------------------------------------------
// capacitor.config.ts — SafeSphere Android wrapper (Phase: APK packaging).
//
// The APK is a native WebView shell that loads the deployed SafeSphere
// site. All server-side features (auth, Supabase, API routes, offline
// service worker) keep working because the WebView talks to the same
// production origin as any browser.
//
// IMPORTANT — changing your production domain:
//   1. Update `server.url` below to the new origin.
//   2. Run `npx cap sync android` (or just re-run the CI workflow)
//   3. Rebuild the APK — the old URL is baked in, so a domain change
//      requires a rebuild.
// ---------------------------------------------------------------------

const config: CapacitorConfig = {
  appId: "com.safesphere.app",
  appName: "SafeSphere",
  webDir: "web",
  server: {
    // Live production origin. The whole app runs from here inside the
    // Android WebView. Change this + rebuild when the domain moves.
    url: process.env.CAPACITOR_SERVER_URL || "https://safesphere0.netlify.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  // Keep the splash + theme in line with the PWA manifest.
  plugins: {
    SplashScreen: {
      backgroundColor: "#0a0f1a",
      launchShowDuration: 1200,
      showSpinner: false,
    },
  },
};

export default config;
