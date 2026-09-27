import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/prisma";
import { responderIdentity } from "@/lib/portal/identity";
import { ProfileForm, TrainingButton } from "@/components/portal/PortalActions";

export const dynamic = "force-dynamic";
export default async function ResponderProfilePage() {
  const actor = await responderIdentity();
  if (!actor) redirect("/portal/login");
  let profile = null;
  let error = false;
  try {
    profile = await prisma.responderProfile.findUnique({ where: { id: actor.id } });
  } catch {
    error = true;
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/portal" className="text-cyan-300">
        ← Verification queue
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Responder profile</h1>
      <p className="mt-2 text-slate-300">
        Tell the district team who you represent. Registration never grants field
        verification authority automatically.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-400 p-4 text-rose-200"
        >
          Database unavailable. Your profile cannot be saved right now.
        </p>
      )}
      {profile && (
        <p className="mt-4 rounded-xl border border-white/20 bg-slate-900 p-4">
          Approval: <strong className="capitalize">{profile.approvalStatus}</strong> ·
          Availability: {profile.availability} · Tier: {profile.tier} · Completed reviews:{" "}
          {profile.totalVerifications}
        </p>
      )}
      <div className="mt-6 rounded-xl border border-white/10 bg-slate-900 p-5">
        <ProfileForm profile={profile} />
      </div>
      {profile && !profile.trainingCompletedAt && (
        <section className="mt-6 rounded-xl border border-cyan-400/30 bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Before your first assignment</h2>
          <ol className="mt-3 list-inside list-decimal space-y-3 text-sm text-slate-300">
            <li>
              <strong>Verified:</strong> You personally observed the reported condition.
              Record a clear photo and explain the current severity.
            </li>
            <li>
              <strong>Partially true:</strong> The incident exists, but the original
              description differs. Explain exactly what differs.
            </li>
            <li>
              <strong>False alarm:</strong> The condition is absent or resolved. Record a
              photo and describe why it could not be confirmed.
            </li>
          </ol>
          <p className="my-4 text-xs text-amber-200">
            Never enter unsafe conditions for a photo. Escalate when safety or rescue
            needs take priority.
          </p>
          <TrainingButton />
        </section>
      )}
    </main>
  );
}
