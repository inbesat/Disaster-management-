import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateSqlColumn,
  sanitizeFilename,
  sanitizeInput,
} from "@/lib/security/sanitize";
import { validateUploadFile, validateMagicNumbers } from "@/lib/security/upload-security";
import { rateLimit } from "@/lib/security/rate-limit";
import { requireRole } from "@/lib/security/require-role";
import {
  enforceDistrictScope,
  assertDistrictAccess,
} from "@/lib/security/data-isolation";
import { guardPromptInput } from "@/lib/ai/llm-guard";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

// Mock next/headers for requireRole
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
  })),
}));

describe("Security Regression Tests (Prompt 19.2)", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  // 1. SQL Injection
  describe("1. SQL Injection Prevention", () => {
    const ALLOWED_COLUMNS = ["created_at", "district_id", "severity", "status"] as const;

    it("rejects malicious SQL column names and payloads", () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "1; DROP TABLE users;--",
        "admin'--",
        "UNION SELECT * FROM information_schema.tables",
      ];

      for (const payload of sqlPayloads) {
        expect(() => validateSqlColumn(payload, ALLOWED_COLUMNS)).toThrow(
          /Invalid column name/,
        );
      }
    });

    it("allows safe whitelisted column names", () => {
      expect(validateSqlColumn("created_at", ALLOWED_COLUMNS)).toBe("created_at");
      expect(validateSqlColumn("district_id", ALLOWED_COLUMNS)).toBe("district_id");
    });
  });

  // 2. XSS Prevention
  describe("2. XSS Input Sanitization", () => {
    it("strips and neutralizes script tags and event handlers from text inputs", () => {
      const xssPayloads = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert(1)>",
        "<a href='javascript:alert(1)'>click me</a>",
        "<svg onload=alert(1)>",
      ];

      for (const payload of xssPayloads) {
        const sanitizedPrompt = guardPromptInput(payload).sanitizedInput;
        expect(sanitizedPrompt).not.toContain("<script>");

        const sanitizedText = sanitizeInput(payload);
        expect(sanitizedText).not.toContain("<script>");
        expect(sanitizedText).not.toContain("onerror=");
        expect(sanitizedText).not.toContain("onload=");

        const sanitizedFile = sanitizeFilename(payload);
        expect(sanitizedFile).not.toContain("<script>");
      }
    });
  });

  // 3. Public User Accessing Gov API -> Expect 403 / 401
  describe("3. Government API Authorization Guard", () => {
    it("rejects public citizen session when accessing government endpoints", async () => {
      cookieStore.set("role", "public");
      const result = await requireRole([
        "district_admin",
        "super_admin",
        "field_responder",
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("rejects unauthenticated/guest session when accessing government endpoints", async () => {
      cookieStore.set("guest_mode", "true");
      cookieStore.set("role", "super_admin");
      const result = await requireRole(["district_admin", "super_admin"]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
      }
    });

    it("allows authorized government role (district_admin)", async () => {
      cookieStore.set("demo_mode", "true");
      cookieStore.set("demo_session_id", "audit-demo-session");
      cookieStore.set("role", "district_admin");
      const result = await requireRole(["district_admin", "super_admin"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.role).toBe("district_admin");
      }
    });
  });

  // 4. District Isolation (District A accessing District B -> Expect 403)
  describe("4. Cross-District Data Isolation", () => {
    it("denies access when District A user attempts to request District B data", () => {
      const userDistrict = "patna";
      const targetDistrict = "gaya";

      const err = assertDistrictAccess(targetDistrict, userDistrict, "district_admin");
      expect(err).toMatch(/Unauthorized/i);

      const mockData = [
        { id: "1", district: "patna" },
        { id: "2", district: "gaya" },
      ];

      const scoped = enforceDistrictScope(mockData, userDistrict, "district_admin");
      expect(scoped).toHaveLength(1);
      expect(scoped[0].district).toBe("patna");
    });

    it("grants access when user requests data for their own district", () => {
      const err = assertDistrictAccess("patna", "patna", "district_admin");
      expect(err).toBeNull();
    });

    it("allows super_admin to access any district data", () => {
      const err = assertDistrictAccess("gaya", "patna", "super_admin");
      expect(err).toBeNull();

      const mockData = [
        { id: "1", district: "patna" },
        { id: "2", district: "gaya" },
      ];
      const scoped = enforceDistrictScope(mockData, "patna", "super_admin");
      expect(scoped).toHaveLength(2);
    });
  });

  // 5. Role Escalation
  describe("5. Self Role Escalation Prevention", () => {
    it("prevents non-super_admin from requesting super_admin role permissions", async () => {
      cookieStore.set("demo_mode", "true");
      cookieStore.set("demo_session_id", "audit-demo-session");
      cookieStore.set("role", "district_admin");
      const result = await requireRole(["super_admin"]);
      expect(result.ok).toBe(false);
    });
  });

  // 6. Executable File Upload Rejection
  describe("6. Executable File Upload Security", () => {
    it("rejects executable file signatures and forbidden MIME types", () => {
      // Fake executable binary / HTML payload
      const exeBuffer = new TextEncoder().encode(
        "MZ binary executable content <script>alert(1)</script>",
      );
      const validation = validateUploadFile(
        exeBuffer,
        "application/x-msdownload",
        "document",
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toMatch(/Invalid MIME type|magic number/i);
    });

    it("rejects SVG/HTML scriptable content disguised as image or document", () => {
      const htmlBuffer = new TextEncoder().encode(
        "<!DOCTYPE html><html><script>alert('xss')</script></html>",
      );
      const magicCheck = validateMagicNumbers(htmlBuffer);

      expect(magicCheck.valid).toBe(false);
      expect(magicCheck.reason).toMatch(/scriptable|SVG\/HTML/i);
    });

    it("accepts valid emergency attachments (PDF with valid magic numbers)", () => {
      const pdfBuffer = new TextEncoder().encode("%PDF-1.4 mock pdf header");
      const validation = validateUploadFile(pdfBuffer, "application/pdf", "document");

      expect(validation.valid).toBe(true);
      expect(validation.extension).toBe("pdf");
    });
  });

  // 7. Rate Limiting (>100 API Requests / Minute -> 429)
  describe("7. API Rate Limiting", () => {
    it("enforces rate limits when requests exceed budget (e.g. >100/min)", () => {
      const key = "test-rate-limit-ip-123";
      const limit = 10;
      const windowMs = 60 * 1000;

      // Exhaust limit
      for (let i = 0; i < limit; i++) {
        const res = rateLimit(key, limit, windowMs);
        expect(res.success).toBe(true);
      }

      // Next call must be blocked
      const blocked = rateLimit(key, limit, windowMs);
      expect(blocked.success).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  // 8. CSRF Without Token / Invalid Origin Rejection
  describe("8. CSRF & Origin Validation via Middleware", () => {
    it("rejects state-changing requests with missing CSRF token in middleware", async () => {
      const req = new NextRequest("http://localhost:3000/api/public/shelters", {
        method: "POST",
        body: JSON.stringify({ name: "Shelter A" }),
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/CSRF/i);
    });

    it("rejects requests with unauthorized CORS origins (e.g. evil.com)", async () => {
      const req = new NextRequest("http://localhost:3000/api/health", {
        method: "GET",
        headers: { Origin: "https://evil-attacker.com" },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/CORS/i);
    });
  });
});
