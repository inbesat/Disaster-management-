import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/prisma";
import { demoWhere, resolveDemoScope } from "@/lib/demo/scope";
import { requireRole } from "@/lib/security/require-role";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const access = await requireRole(["field_responder", "district_admin", "super_admin"]);
  if (!access.ok) redirect("/login");
  const scope = resolveDemoScope();
  let profiles: Awaited<ReturnType<typeof prisma.responderProfile.findMany>> = [];
  let assignments: Array<{ assignedResponderId: string | null; workflowStatus: string }> =
    [];
  let unavailable = false;
  try {
    profiles = await prisma.responderProfile.findMany({
      where: scope.demo
        ? { id: `demo:${scope.sessionId}` }
        : { NOT: { id: { startsWith: "demo:" } } },
      orderBy: { name: "asc" },
      take: 100,
    });
    assignments = await prisma.crowdsourcedReport.findMany({
      where: { ...demoWhere(scope), workflowStatus: { in: ["claimed", "checked_in"] } },
      select: { assignedResponderId: true, workflowStatus: true },
      take: 300,
    });
  } catch {
    unavailable = true;
  }
  const activeIds = new Set(assignments.map((item) => item.assignedResponderId));
  const approved = profiles.filter((profile) => profile.approvalStatus === "approved");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
            SafeSphere · Field network
          </p>
          <h1 className="mt-2 text-3xl font-bold">Team & responders</h1>
          <p className="mt-2 text-sm text-slate-400">
            Registered teams, approval status and current availability.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/portal"
            className="rounded-lg border border-cyan-400/50 px-4 py-2 text-sm text-cyan-300"
          >
            Field queue
          </Link>
          {["district_admin", "super_admin"].includes(access.role) && (
            <Link
              href="/portal/admin"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
            >
              Review responders
            </Link>
          )}
        </div>
      </div>
      {unavailable ? (
        <p
          role="alert"
          className="mt-7 rounded-xl border border-rose-500/40 bg-rose-950/30 p-5 text-rose-200"
        >
          Responder records are unavailable. Check the database connection and field
          portal migration.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Summary label="Registered" value={profiles.length} />
            <Summary label="Approved" value={approved.length} />
            <Summary
              label="On a verification"
              value={approved.filter((profile) => activeIds.has(profile.id)).length}
            />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-xl border border-white/10 bg-slate-900 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{profile.name}</h2>
                    <p className="text-sm text-slate-400">
                      {profile.organization} ·{" "}
                      {profile.organizationType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 px-2 py-1 text-xs capitalize">
                    {profile.approvalStatus}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-slate-500">District</dt>
                    <dd>{profile.district}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Tier</dt>
                    <dd className="capitalize">{profile.tier}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      {activeIds.has(profile.id)
                        ? "On verification"
                        : profile.availability === "available"
                          ? "Available"
                          : "Off duty"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Completed reviews</dt>
                    <dd>{profile.totalVerifications}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          {!profiles.length && (
            <p className="mt-8 rounded-xl border border-white/10 p-5 text-slate-400">
              No responder profiles in this session yet. Use the field portal to create
              one.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <strong className="mt-2 block text-3xl text-cyan-300">{value}</strong>
    </div>
  );
}
