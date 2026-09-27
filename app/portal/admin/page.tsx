import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/prisma";
import { responderIdentity } from "@/lib/portal/identity";
import { demoWhere } from "@/lib/demo/scope";
import { isClaimExpired } from "@/lib/portal/workflow";
import { anonymizePII } from "@/lib/security/sanitize";
import {
  ApprovalButtons,
  AssignmentForm,
  PrioritySelect,
  TierSelect,
  DemoWaveButtons,
} from "@/components/portal/PortalActions";

export const dynamic = "force-dynamic";
export default async function PortalAdminPage() {
  const actor = await responderIdentity();
  if (!actor || !["district_admin", "super_admin"].includes(actor.role)) redirect("/403");
  let profiles: Awaited<ReturnType<typeof prisma.responderProfile.findMany>> = [];
  let reports: Awaited<ReturnType<typeof prisma.crowdsourcedReport.findMany>> = [];
  let error = false;
  try {
    [profiles, reports] = await Promise.all([
      prisma.responderProfile.findMany({
        where: actor.scope.demo
          ? { id: `demo:${actor.scope.sessionId}` }
          : { id: { not: { startsWith: "demo:" } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.crowdsourcedReport.findMany({
        where: {
          ...demoWhere(actor.scope),
          workflowStatus: { in: ["queued", "claimed", "checked_in", "escalated"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
  } catch {
    error = true;
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/gov/dashboard" className="text-cyan-300">
        ← Government dashboard
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Field verification oversight</h1>
      <p className="mt-2 text-slate-300">
        Approve responders, triage priorities, assign field work, and review escalations
        from the same report pipeline.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-400 p-4 text-rose-200"
        >
          Database unavailable. Oversight cannot load.
        </p>
      )}
      {actor.scope.demo && <DemoWaveButtons />}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Responder access ({profiles.length})</h2>
          <div className="mt-3 space-y-3">
            {profiles.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-white/10 bg-slate-900 p-4"
              >
                <p className="font-bold">
                  {p.name} · {p.organization}
                </p>
                <p className="text-sm text-slate-400">
                  {p.organizationType} · {p.district} · {p.approvalStatus}
                </p>
                <div className="mt-3">
                  <ApprovalButtons id={p.id} />
                </div>
                <div className="mt-3">
                  <TierSelect id={p.id} value={p.tier} />
                </div>
              </article>
            ))}
            {!profiles.length && (
              <p className="text-slate-400">No responder profiles in this session.</p>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold">
            Active and escalated reports ({reports.length})
          </h2>
          <div className="mt-3 space-y-3">
            {reports.map((r) => (
              <article
                key={r.id}
                className="rounded-xl border border-white/10 bg-slate-900 p-4"
              >
                <div className="flex justify-between gap-3">
                  <Link
                    href={`/portal/reports/${r.id}`}
                    className="font-bold text-cyan-300"
                  >
                    {r.reportType.replaceAll("_", " ")} · {r.id.slice(0, 8)}
                  </Link>
                  <span className="text-sm text-amber-300">{r.workflowStatus}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm">{anonymizePII(r.rawText)}</p>
                <div className="mt-3">
                  <PrioritySelect id={r.id} value={r.priority} />
                </div>
                {(r.workflowStatus === "queued" ||
                  isClaimExpired(r.workflowStatus, r.claimedAt)) && (
                  <AssignmentForm
                    id={r.id}
                    responders={profiles
                      .filter(
                        (p) =>
                          p.approvalStatus === "approved" &&
                          p.availability === "available",
                      )
                      .map((p) => ({
                        id: p.id,
                        name: p.name,
                        organization: p.organization,
                      }))}
                  />
                )}
              </article>
            ))}
            {!reports.length && (
              <p className="text-slate-400">No active reports in this session.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
