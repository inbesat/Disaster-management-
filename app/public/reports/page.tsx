import { createHash } from "node:crypto";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/server/prisma";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";
import DisputeButton from "@/components/public/report/DisputeButton";

export const dynamic = "force-dynamic";

function statusLabel(workflow: string, verification: string) {
  if (workflow === "completed")
    return verification === "partial"
      ? "Partially true"
      : verification === "rejected"
        ? "Not confirmed"
        : "Field verified";
  if (workflow === "escalated") return "Government review";
  if (workflow === "checked_in") return "Responder on site";
  if (workflow === "claimed") return "Responder assigned";
  return "Awaiting responder";
}

export default async function MyReportsPage() {
  const token = cookies().get("safesphere_reporter")?.value;
  const hash = token ? createHash("sha256").update(token).digest("hex") : null;
  let reports: Awaited<ReturnType<typeof prisma.crowdsourcedReport.findMany>> = [];
  const teams: Record<string, string> = {};
  let error = false;
  if (hash) {
    try {
      reports = await prisma.crowdsourcedReport.findMany({
        where: { reporterTokenHash: hash, ...demoWhere(resolveDemoScope()) },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const ids = reports
        .map((r) => r.assignedResponderId)
        .filter((id): id is string => Boolean(id));
      if (ids.length) {
        const profiles = await prisma.responderProfile.findMany({
          where: { id: { in: ids } },
          select: { id: true, organization: true },
        });
        for (const profile of profiles) teams[profile.id] = profile.organization;
      }
    } catch {
      error = true;
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0F1D] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/public/dashboard" className="text-cyan-300">
          ← Citizen dashboard
        </Link>
        <h1 className="mt-6 text-3xl font-bold">My reports</h1>
        <p className="mt-2 text-slate-300">
          Status for reports submitted from this browser. Keep your report ID for
          reference. Call 1070 for urgent help.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-rose-400 p-4 text-rose-200"
          >
            Status is temporarily unavailable. Your reports were not changed.
          </p>
        )}
        {!hash && (
          <p className="mt-6 rounded-xl border border-white/10 p-5 text-slate-300">
            No report receipt exists on this browser.{" "}
            <Link href="/public/report" className="text-cyan-300 underline">
              Submit a report
            </Link>
          </p>
        )}
        <div className="mt-6 space-y-4">
          {reports.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-white/10 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-bold capitalize">
                  {r.reportType.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs">
                  {statusLabel(r.workflowStatus, r.verificationStatus)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-200">{r.rawText}</p>
              <p className="mt-3 break-all text-xs text-slate-400">ID: {r.id}</p>
              <ol className="mt-4 space-y-1 border-l-2 border-cyan-500/40 pl-3 text-xs text-slate-300">
                <li>Submitted · {r.createdAt.toLocaleString()}</li>
                {r.claimedAt && <li>Assigned · {r.claimedAt.toLocaleString()}</li>}
                {r.checkedInAt && (
                  <li>Responder on site · {r.checkedInAt.toLocaleString()}</li>
                )}
                {r.completedAt && (
                  <li>
                    {statusLabel(r.workflowStatus, r.verificationStatus)} ·{" "}
                    {r.completedAt.toLocaleString()}
                  </li>
                )}
              </ol>
              {r.assignedResponderId && teams[r.assignedResponderId] && (
                <p className="mt-3 text-xs text-cyan-200">
                  Field organization: {teams[r.assignedResponderId]}
                </p>
              )}
              {r.verdictNote && (
                <p className="mt-3 rounded-lg bg-slate-800 p-3 text-sm">
                  Responder update: {r.verdictNote}
                </p>
              )}
              {r.verificationStatus === "rejected" && r.disputeCount === 0 && (
                <DisputeButton id={r.id} />
              )}
              {r.disputeCount > 0 && (
                <p className="mt-3 text-xs text-amber-200">
                  A second review was requested
                </p>
              )}
            </article>
          ))}
          {hash && !reports.length && !error && (
            <p className="text-slate-400">
              No reports found for this browser and session.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
