import Link from "next/link";
import { fieldDemoLogin } from "@/app/actions/auth";
import FieldLoginForm from "./FieldLoginForm";

export default function FieldPortalLogin() {
  return (
    <main className="min-h-screen bg-[#0A0F1D] px-4 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-cyan-400/30 bg-slate-900 p-6 shadow-xl">
        <Link href="/login" className="text-sm text-cyan-300">
          ← All portals
        </Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-cyan-300">
          SafeSphere · Field responders
        </p>
        <h1 className="mt-2 text-3xl font-bold">Verification portal</h1>
        <p className="mt-2 text-sm text-slate-300">
          NGOs, police, medical and rescue teams: enter any email and password to
          continue in this temporary demo.
        </p>
        <FieldLoginForm />
        <form action={fieldDemoLogin} className="mt-5 border-t border-white/10 pt-5">
          <button className="w-full rounded-xl border border-cyan-400 px-4 py-3 font-semibold text-cyan-300">
            Continue without entering details
          </button>
        </form>
      </div>
    </main>
  );
}
