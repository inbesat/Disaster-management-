import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/security/require-role";
import { resolveDemoScope } from "@/lib/demo/scope";
import { prisma } from "@/server/prisma";

export async function responderIdentity() {
  const auth = await requireRole(["field_responder", "district_admin", "super_admin"]);
  if (!auth.ok) return null;
  const scope = resolveDemoScope();
  if (scope.demo && scope.sessionId) {
    return { id: `demo:${scope.sessionId}`, role: auth.role, scope };
  }
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (user) return { id: user.id, role: auth.role, scope };
  } catch {
    /* The database-backed portal requires a real identity. */
  }
  return null;
}

export function citizenToken() {
  return cookies().get("safesphere_reporter")?.value ?? null;
}

/** Reading report details also requires approval and training, not just a role cookie. */
export async function approvedResponderIdentity() {
  const actor = await responderIdentity();
  if (!actor) return null;
  if (actor.role === "district_admin" || actor.role === "super_admin") return actor;
  try {
    const profile = await prisma.responderProfile.findUnique({
      where: { id: actor.id },
      select: { approvalStatus: true, trainingCompletedAt: true },
    });
    return profile?.approvalStatus === "approved" && profile.trainingCompletedAt
      ? actor
      : null;
  } catch {
    return null;
  }
}
