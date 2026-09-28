// ---------------------------------------------------------------------
// lib/security/require-role.test.ts — Phase 12 · Step 3 · RBAC guard.
// Locks requireRole's decision matrix: guests always 401, role-cookie
// admission in demo mode, profile-role admission (and fallback) when
// Supabase is configured, and 403 for under-privileged callers.
//
// The `next/headers` cookies() and `@/lib/supabase/server` createClient
// are module-mocked; env vars are stubbed per describe block to flip
// between cookie-only demo mode and Supabase mode.
// ---------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- cookie store shared by the mocked next/headers cookies() ---------
const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
  })),
}));

// --- Supabase server client mock --------------------------------------
// getUser resolves per-test; from(...).select(...).eq(...).maybeSingle()
// resolves the profile role per-test.
const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
      })),
    })),
  })),
}));

import { requireRole } from "./require-role";

const GOV_ROLES = ["district_admin", "super_admin", "field_responder"] as const;

beforeEach(() => {
  cookieStore.clear();
  getUserMock.mockReset();
  maybeSingleMock.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cookie-only demo mode (no Supabase env)", () => {
  beforeEach(() => {
    cookieStore.set("demo_mode", "true");
    cookieStore.set("demo_session_id", "audit-demo-session");
  });
  it("admits a gov role cookie against the allow-list", async () => {
    cookieStore.set("role", "district_admin");
    const result = await requireRole(GOV_ROLES);
    expect(result).toEqual({ ok: true, role: "district_admin" });
  });

  it("admits any listed role — field_responder and super_admin too", async () => {
    cookieStore.set("role", "field_responder");
    expect((await requireRole(GOV_ROLES)).ok).toBe(true);
    cookieStore.set("role", "super_admin");
    expect((await requireRole(GOV_ROLES)).ok).toBe(true);
  });

  it("rejects a public citizen (no gov session — 401)", async () => {
    cookieStore.set("role", "public");
    const result = await requireRole(GOV_ROLES);
    // The public role is not a gov session, so the guard reports 401
    // ("a government session is required") in cookie-only mode.
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects an unknown/missing role (401)", async () => {
    const result = await requireRole(GOV_ROLES);
    expect(result).toMatchObject({ ok: false, status: 401 });
    cookieStore.set("role", "viewer");
    expect((await requireRole(GOV_ROLES)).ok).toBe(false);
  });

  it("guests never pass, even with a gov role cookie present", async () => {
    cookieStore.set("guest_mode", "true");
    cookieStore.set("role", "super_admin");
    const result = await requireRole(GOV_ROLES);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("respects a narrower allow-list (super_admin only)", async () => {
    cookieStore.set("role", "district_admin");
    expect((await requireRole(["super_admin"])).ok).toBe(false);
    cookieStore.set("role", "super_admin");
    expect((await requireRole(["super_admin"])).ok).toBe(true);
  });

  it("requires the session cookie that demo login creates", async () => {
    cookieStore.set("role", "district_admin");
    cookieStore.delete("demo_session_id");
    expect((await requireRole(GOV_ROLES)).ok).toBe(false);
  });
});

describe("Supabase mode (env configured)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("admits a logged-in user whose profile role is in the allow-list", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingleMock.mockResolvedValue({ data: { role: "district_admin" }, error: null });
    const result = await requireRole(GOV_ROLES);
    expect(result).toEqual({ ok: true, role: "district_admin" });
  });

  it("returns 403 when the profile role is not in the allow-list", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingleMock.mockResolvedValue({ data: { role: "public" }, error: null });
    const result = await requireRole(GOV_ROLES);
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a signed-in user with no profile row — the cookie never overrides a real session", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    cookieStore.set("role", "field_responder");
    const result = await requireRole(GOV_ROLES);
    expect(result.ok).toBe(false);
  });

  it("admits an explicitly enabled demo cookie session", async () => {
    vi.stubEnv("DEMO_AUTH_ENABLED", "true");
    cookieStore.set("demo_mode", "true");
    cookieStore.set("demo_session_id", "audit-demo-session");
    // govDemoLogin / govLogin write only cookies; the middleware and admin
    // layout accept that session, so the API guard must too.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    cookieStore.set("role", "super_admin");
    expect(await requireRole(GOV_ROLES)).toEqual({ ok: true, role: "super_admin" });
    cookieStore.set("role", "district_admin");
    expect(await requireRole(GOV_ROLES)).toEqual({ ok: true, role: "district_admin" });
  });

  it("401s an unauthenticated caller with no cookie", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await requireRole(GOV_ROLES)).ok).toBe(false);
  });

  it("fails closed with 403 for a guest even when Supabase is up", async () => {
    cookieStore.set("guest_mode", "true");
    cookieStore.set("role", "super_admin");
    expect((await requireRole(GOV_ROLES)).ok).toBe(false);
  });

  it("fails closed (401) when the Supabase lookup throws", async () => {
    getUserMock.mockRejectedValue(new Error("network down"));
    cookieStore.set("role", "district_admin");
    const result = await requireRole(GOV_ROLES);
    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});
