import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { probeEmergencyPlanner, type ProviderGroup } from "@/lib/ai/openrouter";
import { createRateLimiter } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// Rate limit: 5 provider probes per minute per IP (each fires live API calls)
const aiTestLimiter = createRateLimiter(5, 60_000);

// ---------------------------------------------------------------------
// app/api/ai/test/route.ts — live "Test Connection" for Settings · AI.
//
// The planner's SDK tools never graduate the client key to the server
// (keys stay in localStorage), so this endpoint reports the health of the
// server-configured provider chain (GROQ_API_KEY / _BACKUP,
// OPENROUTER_API_KEY / _BACKUP, BLUESMINDS_API_KEY) for the provider
// family the operator selected. Same guardrails as the chat route.
// ---------------------------------------------------------------------

const PROVIDER_GROUPS: Record<string, ProviderGroup> = {
  "groq-llama3": "groq",
  "openai-gpt4o": "openrouter",
  "anthropic-claude35": "openrouter",
  "local-airgapped": "auto",
};

async function isOperator(): Promise<boolean> {
  const cookieStore = await cookies();
  // Guest (auth-bypassed demo) mode mirrors the chat route's default.
  if (cookieStore.get("guest_mode")?.value === "true") return true;
  if (
    process.env.DEMO_AUTH_ENABLED === "true" &&
    cookieStore.get("demo_mode")?.value === "true" &&
    ["district_admin", "super_admin", "field_responder"].includes(
      cookieStore.get("role")?.value ?? "",
    )
  ) return true;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!(await isOperator())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "anonymous";
  const rateResult = aiTestLimiter(`aitest:${ip}`);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.resetTime - Date.now()) / 1000)) } },
    );
  }

  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") ?? undefined;
  const preferred = provider ? PROVIDER_GROUPS[provider] : undefined;

  const report = await probeEmergencyPlanner(preferred);
  return NextResponse.json(report);
}
