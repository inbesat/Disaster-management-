import Link from "next/link";
import { prisma } from "@/server/prisma";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";
import { anonymizePII } from "@/lib/security/sanitize";

/** Government view of the same reports claimed and verified in the field portal. */
export default async function CrowdReportsWidget() {
  let reports: Awaited<ReturnType<typeof prisma.crowdsourcedReport.findMany>> = [];
  let counts = { pending: 0, verifying: 0, verified: 0, rejected: 0, escalated: 0 };
  let error = false;
  try {
    const scope = demoWhere(resolveDemoScope());
    const [recent, pending, verifying, verified, rejected, escalated] = await Promise.all(
      [
        prisma.crowdsourcedReport.findMany({
          where: scope,
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.crowdsourcedReport.count({
          where: { ...scope, workflowStatus: "queued" },
        }),
        prisma.crowdsourcedReport.count({
          where: { ...scope, workflowStatus: { in: ["claimed", "checked_in"] } },
        }),
        prisma.crowdsourcedReport.count({
          where: { ...scope, verificationStatus: "verified" },
        }),
        prisma.crowdsourcedReport.count({
          where: { ...scope, verificationStatus: "rejected" },
        }),
        prisma.crowdsourcedReport.count({
          where: { ...scope, workflowStatus: "escalated" },
        }),
      ],
    );
    reports = recent;
    counts = { pending, verifying, verified, rejected, escalated };
  } catch {
    error = true;
  }
  return (
    <section className="flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.04] p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Citizen reports</h2>
        <span className="text-xs text-amber-300">{counts.pending} pending</span>
      </div>
      {!error && (
        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[0.65rem]">
          <span className="rounded bg-slate-800 p-1">
            {counts.verifying}
            <br />
            in field
          </span>
          <span className="rounded bg-emerald-900/40 p-1">
            {counts.verified}
            <br />
            verified
          </span>
          <span className="rounded bg-slate-800 p-1">
            {counts.rejected}
            <br />
            rejected
          </span>
          <span className="rounded bg-rose-900/40 p-1">
            {counts.escalated}
            <br />
            escalated
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          Report database unavailable.
        </p>
      )}
      <ul className="mt-3 flex-1 space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="line-clamp-2 text-sm">{anonymizePII(r.rawText)}</p>
            <p className="mt-2 text-xs text-slate-400">
              {r.reportType.replaceAll("_", " ")} ·{" "}
              {r.workflowStatus === "completed" ? r.verificationStatus : r.workflowStatus}
            </p>
          </li>
        ))}
        {!reports.length && !error && (
          <li className="text-sm text-slate-400">No citizen reports in this session.</li>
        )}
      </ul>
      <Link
        href="/portal/admin"
        className="mt-4 rounded-lg border border-cyan-400/50 px-3 py-2 text-center text-sm font-semibold text-cyan-300"
      >
        Review and triage →
      </Link>
    </section>
  );
}
