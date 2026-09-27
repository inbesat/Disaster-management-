import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/prisma";
import { approvedResponderIdentity } from "@/lib/portal/identity";
import { demoWhere } from "@/lib/demo/scope";
import {
  CheckInButton,
  ClaimButton,
  DemoCheckInButton,
  VerdictForm,
} from "@/components/portal/PortalActions";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { isClaimExpired } from "@/lib/portal/workflow";
import { anonymizePII } from "@/lib/security/sanitize";

export const dynamic = "force-dynamic";
export default async function VerificationDetail({ params }: { params: { id: string } }) {
  const actor = await approvedResponderIdentity();
  if (!actor) redirect("/portal/profile");
  let report = null;
  let error = false;
  try {
    report = await prisma.crowdsourcedReport.findFirst({
      where: { id: params.id, ...demoWhere(actor.scope) },
      include: { verificationEvents: { orderBy: { createdAt: "asc" } } },
    });
  } catch {
    error = true;
  }
  if (!report && !error) notFound();
  if (!report)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-rose-200">
        Report database unavailable.{" "}
        <Link href="/portal" className="underline">
          Return to queue
        </Link>
      </main>
    );
  const mine = report.assignedResponderId === actor.id;
  if (actor.role === "field_responder" && !mine) redirect("/portal");
  let photoUrl: string | null = null;
  if (
    report.imageUrl?.startsWith("citizen-reports:") &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const client = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const { data } = await client.storage
      .from("citizen-reports")
      .createSignedUrl(report.imageUrl.slice("citizen-reports:".length), 600);
    photoUrl = data?.signedUrl ?? null;
  }
  const href = `https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=15/${report.lat}/${report.lng}`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <Link href="/portal" className="text-cyan-300">
        ← Verification queue
      </Link>
      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
          Report {report.id.slice(0, 8)}
        </p>
        <h1 className="mt-2 text-2xl font-bold capitalize">
          {report.reportType.replaceAll("_", " ")}
        </h1>
        <p className="mt-3 text-slate-200">{anonymizePII(report.rawText)}</p>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Citizen-submitted report evidence"
            className="mt-4 max-h-80 w-full rounded-xl object-contain"
          />
        )}
        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <span>Priority: {report.priority}</span>
          <span>Status: {report.workflowStatus}</span>
          <span>
            Location: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
          </span>
          <span>Submitted: {report.createdAt.toLocaleString()}</span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-block rounded-xl border border-cyan-400 px-4 py-2 text-cyan-300"
        >
          View location on map ↗
        </a>
      </div>
      <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
        <h2 className="text-xl font-bold">Verification steps</h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-300">
          <li>Claim the report</li>
          <li>Navigate safely and check in within 100 m using device GPS</li>
          <li>Record your observations and evidence</li>
          <li>Verify, reject, or escalate</li>
        </ol>
        <div className="mt-5">
          {(report.workflowStatus === "queued" ||
            isClaimExpired(report.workflowStatus, report.claimedAt)) && (
            <ClaimButton id={report.id} />
          )}
          {mine &&
            report.workflowStatus === "claimed" &&
            !isClaimExpired(report.workflowStatus, report.claimedAt) && (
              <CheckInButton id={report.id} />
            )}
          {actor.scope.demo && mine && report.workflowStatus === "claimed" && (
            <DemoCheckInButton id={report.id} />
          )}
          {mine && report.workflowStatus === "checked_in" && (
            <VerdictForm id={report.id} />
          )}
          {!mine && report.workflowStatus !== "queued" && (
            <p className="text-sm text-amber-300">
              Assigned to another responder. Read-only until their review is complete.
            </p>
          )}
          {["completed", "escalated"].includes(report.workflowStatus) && (
            <p className="text-sm text-cyan-300">
              Review complete: {report.verificationStatus}{" "}
              {report.verdictNote && `· ${report.verdictNote}`}
            </p>
          )}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
        <h2 className="text-xl font-bold">Audit timeline</h2>
        <ol className="mt-3 space-y-3">
          {report.verificationEvents.map((e) => (
            <li key={e.id} className="border-l-2 border-cyan-500 pl-3 text-sm">
              <strong className="capitalize">{e.action.replaceAll("_", " ")}</strong> ·{" "}
              {e.createdAt.toLocaleString()}
              {e.note && <p className="text-slate-300">{e.note}</p>}
              {e.evidenceUrl && (
                <p className="text-xs text-cyan-300">Private evidence attached</p>
              )}
            </li>
          ))}
          {!report.verificationEvents.length && (
            <li className="text-sm text-slate-400">No field actions yet.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
