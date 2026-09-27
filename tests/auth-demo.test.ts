import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks for Next.js navigation and headers
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: mockSet,
    delete: mockDelete,
    get: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: vi.fn().mockRejectedValue(new Error("Supabase unavailable")),
      signInWithPassword: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
      signUp: vi.fn().mockRejectedValue(new Error("Supabase unavailable")),
    },
  }),
}));

import { verifyOTP, signInAction, signUpAction } from "@/app/actions/auth";

describe("Demo Mode Authentication Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEMO_AUTH_ENABLED", "true");
  });

  describe("verifyOTP", () => {
    it("accepts any arbitrary OTP code and redirects to command center", async () => {
      await expect(verifyOTP("123456")).rejects.toThrow("REDIRECT:/command-center");
      expect(mockSet).toHaveBeenCalledWith("guest_mode", "true", expect.any(Object));
    });

    it("accepts random digit string OTPs", async () => {
      await expect(verifyOTP("999888")).rejects.toThrow("REDIRECT:/command-center");
      expect(mockSet).toHaveBeenCalledWith("guest_mode", "true", expect.any(Object));
    });

    it("returns error message if no digits provided", async () => {
      const res = await verifyOTP("");
      expect(res.ok).toBe(false);
      expect(res.message).toContain("Enter the code");
    });
  });

  describe("signInAction", () => {
    it("allows sign in with arbitrary citizen email and password", async () => {
      const formData = new FormData();
      formData.append("email", "citizen@example.com");
      formData.append("password", "anypassword");

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/public/dashboard");
      expect(mockSet).toHaveBeenCalledWith("role", "public", expect.any(Object));
    });

    it("allows sign in with admin email and routes to gov dashboard", async () => {
      const formData = new FormData();
      formData.append("email", "admin@district.gov.in");
      formData.append("password", "secret");

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/gov/dashboard");
      expect(mockSet).toHaveBeenCalledWith("role", "district_admin", expect.any(Object));
    });

    it("allows sign in with super admin email and routes to gov overview", async () => {
      const formData = new FormData();
      formData.append("email", "superadmin@state.gov.in");
      formData.append("password", "pass123");

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/gov/overview");
      expect(mockSet).toHaveBeenCalledWith("role", "super_admin", expect.any(Object));
    });
  });

  describe("signUpAction", () => {
    it("allows sign up with arbitrary details and falls back to demo login", async () => {
      const formData = new FormData();
      formData.append("fullName", "John Doe");
      formData.append("email", "johndoe@example.com");
      formData.append("password", "simplepass");

      await expect(signUpAction(formData)).rejects.toThrow("REDIRECT:/public/dashboard");
      expect(mockSet).toHaveBeenCalledWith("role", "public", expect.any(Object));
    });
  });
});

afterEach(() => vi.unstubAllEnvs());
