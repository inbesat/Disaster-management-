import Link from "next/link";
import { cookies } from "next/headers";
import { signOutAction, switchDemoPortal } from "@/app/actions/auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const demo = cookies().get("demo_mode")?.value === "true";
  const role = cookies().get("role")?.value;
  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100">
      <header className="border-b border-cyan-400/25 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/portal" className="text-xl font-black text-cyan-300">
            SafeSphere{" "}
            <span className="text-sm font-semibold text-white">Field Portal</span>
          </Link>
          {role && (
            <nav className="flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/portal">Queue</Link>
              <Link href="/portal/profile">My profile</Link>
              {(role === "district_admin" || role === "super_admin") && (
                <Link href="/portal/admin">Government review</Link>
              )}
              <form action={signOutAction}>
                <button className="text-slate-300">Sign out</button>
              </form>
            </nav>
          )}
        </div>
      </header>
      {demo && (
        <div className="border-b border-amber-400/30 bg-amber-950/30 px-4 py-2 text-center text-sm text-amber-100">
          Demo session ·{" "}
          <form action={switchDemoPortal.bind(null, "public")} className="inline">
            <button className="underline">Citizen view</button>
          </form>{" "}
          ·{" "}
          <form action={switchDemoPortal.bind(null, "field")} className="inline">
            <button className="underline">Field view</button>
          </form>{" "}
          ·{" "}
          <form action={switchDemoPortal.bind(null, "gov")} className="inline">
            <button className="underline">Government view</button>
          </form>
        </div>
      )}
      {children}
    </div>
  );
}
