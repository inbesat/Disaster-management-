import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { prisma } from "@/server/prisma";
import { resolveDemoScope } from "@/lib/demo/scope";

export default async function ResponderTracker() {
  const scope = resolveDemoScope();
  let responders: Array<{
    id: string;
    name: string;
    organization: string;
    availability: string;
  }> = [];
  let unavailable = false;
  try {
    responders = await prisma.responderProfile.findMany({
      where: {
        approvalStatus: "approved",
        ...(scope.demo
          ? { id: `demo:${scope.sessionId}` }
          : { NOT: { id: { startsWith: "demo:" } } }),
      },
      select: { id: true, name: true, organization: true, availability: true },
      orderBy: { name: "asc" },
      take: 8,
    });
  } catch {
    unavailable = true;
  }
  const active = responders.filter(
    (responder) => responder.availability === "available",
  ).length;
  return (
    <section className="flex flex-col rounded-xl border border-white/10 bg-[#111827]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <Users className="h-4 w-4 text-blue-400" /> Responder tracker
        </h2>
        <span className="text-xs text-emerald-300">
          {unavailable ? "Unavailable" : `${active} available`}
        </span>
      </header>
      <div className="p-4">
        {unavailable ? (
          <p className="text-sm text-slate-400">Responder data could not be loaded.</p>
        ) : responders.length ? (
          <div className="flex flex-wrap gap-2">
            {responders.map((responder) => (
              <span
                key={responder.id}
                title={`${responder.name} · ${responder.organization} · ${responder.availability}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-blue-400/40 bg-blue-600/20 text-xs font-bold text-blue-200"
              >
                {responder.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No approved responders in this session.
          </p>
        )}
        <Link
          href="/directory"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-400"
        >
          View all team <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
