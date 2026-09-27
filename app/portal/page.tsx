import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/prisma";
import { responderIdentity } from "@/lib/portal/identity";
import { demoWhere } from "@/lib/demo/scope";
import { ClaimButton, AvailabilityButton } from "@/components/portal/PortalActions";
import { isClaimExpired, isReportOverdue, reportDueAt } from "@/lib/portal/workflow";
import { anonymizePII } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";
export default async function FieldQueuePage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const actor = await responderIdentity();
  if (!actor) redirect("/portal/login");
  let profile = null;
  let reports: Awaited<ReturnType<typeof prisma.crowdsourcedReport.findMany>> = [];
  let offline = false;
  try {
    profile = await prisma.responderProfile.findUnique({ where: { id: actor.id } });
    if (
      actor.role !== "field_responder" ||
      (profile?.approvalStatus === "approved" && profile.trainingCompletedAt)
    ) {
      reports = await prisma.crowdsourcedReport.findMany({
        where: {
          ...demoWhere(actor.scope),
          verificationStatus: "unverified",
          workflowStatus: { in: ["queued", "claimed", "checked_in", "escalated"] },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }
  } catch {
    offline = true;
  }
  const now = new Date();
  const mine = reports.filter(
    (r) =>
      r.assignedResponderId === actor.id &&
      ["claimed", "checked_in"].includes(r.workflowStatus) &&
      !isClaimExpired(r.workflowStatus, r.claimedAt, now),
  );
  const rank = { critical: 0, high: 1, normal: 2 } as const;
  const queueAll = reports
    .filter(
      (r) =>
        r.workflowStatus === "queued" ||
        isClaimExpired(r.workflowStatus, r.claimedAt, now),
    )
    .sort(
      (a, b) =>
        (rank[a.priority as keyof typeof rank] ?? 2) -
          (rank[b.priority as keyof typeof rank] ?? 2) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  const filter = [
    "all",
    "rescue",
    "flooding",
    "road_blocked",
    "shelter_needed",
    "overdue",
  ].includes(searchParams?.filter ?? "")
    ? (searchParams?.filter ?? "all")
    : "all";
  const queue = queueAll.filter(
    (r) =>
      filter === "all" ||
      (filter === "overdue"
        ? isReportOverdue(r.reportType, r.createdAt, r.workflowStatus, now)
        : r.reportType === filter),
  );
  const overdue = reports.filter((r) =>
    isReportOverdue(r.reportType, r.createdAt, r.workflowStatus, now),
  ).length;
  const canClaim =
    actor.role !== "field_responder" ||
    (profile?.approvalStatus === "approved" &&
      profile.availability === "available" &&
      Boolean(profile.trainingCompletedAt));
  return (
    <main className="mx-auto max-w-6xl px-4 py-7 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            Live verification queue
          </p>
          <h1 className="mt-1 text-3xl font-bold">Public reports</h1>
          <p className="mt-2 text-slate-300">
            Claim a report, check in on site, and record what you found. Never travel into
            unsafe conditions for verification alone.
          </p>
        </div>
        <Link
          href="/portal/profile"
          className="rounded-xl border border-cyan-400 px-4 py-2 text-cyan-300"
        >
          My responder profile
        </Link>
      </div>
      {offline && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-400 bg-rose-950/40 p-4 text-rose-200"
        >
          Report database is unavailable. No assignments or updates can be saved.
        </p>
      )}
      {!offline && !profile && actor.role === "field_responder" && (
        <p className="mt-5 rounded-xl border border-amber-400/50 bg-amber-950/30 p-4">
          Create your responder profile before claiming reports.{" "}
          <Link href="/portal/profile" className="underline">
            Set up profile →
          </Link>
        </p>
      )}
      {!offline &&
        profile &&
        actor.role === "field_responder" &&
        (!profile.trainingCompletedAt || profile.approvalStatus !== "approved") && (
          <p className="mt-5 rounded-xl border border-amber-400/50 bg-amber-950/30 p-4 text-amber-100">
            Verification reports unlock after training and government approval.{" "}
            <Link href="/portal/profile" className="underline">
              Review your profile and training →
            </Link>
          </p>
        )}
      {profile && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-slate-900 p-4">
          <span>
            {profile.organization} · {profile.district}
          </span>
          <span className="rounded-full bg-slate-700 px-3 py-1 text-sm">
            Approval: {profile.approvalStatus}
          </span>
          <span className="rounded-full bg-slate-700 px-3 py-1 text-sm">
            {profile.availability}
          </span>
          <AvailabilityButton available={profile.availability === "available"} />
        </div>
      )}
      {!offline && (
        <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
            <strong className="block text-2xl text-cyan-300">{queueAll.length}</strong>
            Open
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
            <strong className="block text-2xl text-amber-300">{overdue}</strong>Overdue
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
            <strong className="block text-2xl text-white">{mine.length}</strong>Mine
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">My assignments ({mine.length})</h2>
          <div className="mt-3 space-y-3">
            {mine.map((r) => (
              <ReportCard key={r.id} report={r} mine />
            ))}
            {!mine.length && (
              <p className="rounded-xl border border-white/10 p-4 text-slate-400">
                No active assignments.
              </p>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-bold">Available reports ({queue.length})</h2>
          <nav aria-label="Filter reports" className="mt-3 flex flex-wrap gap-2 text-xs">
            {[
              ["all", "All"],
              ["rescue", "Rescue"],
              ["flooding", "Flooding"],
              ["road_blocked", "Roads"],
              ["shelter_needed", "Shelters"],
              ["overdue", "Overdue"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={key === "all" ? "/portal" : `/portal?filter=${key}`}
                aria-current={filter === key ? "page" : undefined}
                className={`rounded-full border px-3 py-2 ${filter === key ? "border-cyan-400 bg-cyan-900/40 text-cyan-100" : "border-white/20 text-slate-300"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 space-y-3">
            {queue.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                claim={canClaim}
                preview={actor.role !== "field_responder"}
              />
            ))}
            {!queue.length && (
              <p className="rounded-xl border border-white/10 p-4 text-slate-400">
                No unclaimed reports in this session.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportCard({
  report: r,
  mine = false,
  claim = false,
  preview = false,
}: {
  report: {
    id: string;
    reportType: string;
    rawText: string;
    lat: number;
    lng: number;
    priority: string;
    workflowStatus: string;
    createdAt: Date;
    claimedAt: Date | null;
  };
  mine?: boolean;
  claim?: boolean;
  preview?: boolean;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-900 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-bold capitalize text-cyan-200">
          {r.reportType.replaceAll("_", " ")}
        </span>
        <span className="text-xs uppercase text-amber-300">
          {r.priority} · {r.workflowStatus}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm text-slate-200">
        {anonymizePII(r.rawText)}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · {r.createdAt.toLocaleString()}
      </p>
      <p
        className={`mt-2 text-xs ${isReportOverdue(r.reportType, r.createdAt, r.workflowStatus) ? "text-rose-300" : "text-slate-400"}`}
      >
        Due {reportDueAt(r.reportType, r.createdAt).toLocaleString()}
        {isClaimExpired(r.workflowStatus, r.claimedAt) ? " · previous claim expired" : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(mine || preview) && (
          <Link
            href={`/portal/reports/${r.id}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            {mine ? "Continue verification" : "Details"}
          </Link>
        )}
        {claim && <ClaimButton id={r.id} />}
      </div>
    </article>
  );
}
