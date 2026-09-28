// ---------------------------------------------------------------------
// lib/navigation/chunk-load-recovery.ts
//
// Why this exists
// ---------------
// Pressing Back can hand the browser a document that was captured before the
// most recent deploy. That document's HTML references build assets by content
// hash (`/_next/static/chunks/app/<page>-<hash>.js`), and a new deploy deletes
// the previous deploy's chunks. The browser then fails to load one and webpack
// throws a client-side ChunkLoadError — with no server `digest`, which is why
// it surfaces as the generic "Something went wrong" boundary rather than a
// Next.js digest.
//
// The browser cannot be talked out of restoring that document, so the recovery
// is the canonical one: detect the chunk failure and hard-reload, which lands on
// the *same* URL (including its query and hash) served by the current build.
//
// The service worker makes this easier to hit than it otherwise would be — it
// keeps its own copy of build assets, so the app is offline-capable and
// long-lived, and therefore more likely to be holding a document from a build
// that no longer exists.
//
// Loop safety
// -----------
// A real, unrelated failure must not become a reload loop. We allow exactly one
// hard reload per tab session; a second chunk failure in the same session falls
// through to the normal error UI instead of reloading again.
// ---------------------------------------------------------------------

const RELOAD_GUARD_KEY = "safesphere:chunk-reload-attempted";

/** Messages webpack / the browser / Next.js use for a failed chunk import. */
const CHUNK_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

/**
 * True when `error` is a build-chunk load failure rather than a real
 * application error. Inspects `cause` one level deep because the bundler
 * sometimes wraps the original ChunkLoadError.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { name?: unknown; message?: unknown; cause?: unknown };
  const parts: string[] = [];
  const collect = (value: unknown, depth: number) => {
    if (!value || depth > 2 || typeof value !== "object") return;
    const e = value as { name?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.name === "string") parts.push(e.name);
    if (typeof e.message === "string") parts.push(e.message);
    collect(e.cause, depth + 1);
  };
  collect(candidate, 0);

  const text = parts.join(" ");
  if (!text) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Attempt a single guarded hard reload. Returns true when a reload was
 * triggered, false when the one-per-session guard has already been spent.
 */
export function attemptChunkRecovery(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return false;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, new Date().toISOString());
  } catch {
    // Private mode / blocked storage. Proceed with the single attempt rather
    // than skipping recovery entirely — the worst case is one extra reload.
  }

  window.location.reload();
  return true;
}

/** Test seam: forget that a recovery reload already happened. */
export function resetChunkRecoveryGuard(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // Nothing to clear.
  }
}
