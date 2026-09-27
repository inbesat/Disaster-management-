import Link from "next/link";
import Panel from "@/components/ui/Panel";
import { prisma } from "@/server/prisma";
import { resolveDemoScope } from "@/lib/demo/scope";

export default async function ResponderStatusBoard() {
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
      take: 20,
    });
  } catch {
    unavailable = true;
  }
  return (
    <Panel
      title="Field Responders"
      action={
        <Link href="/directory" className="text-xs text-cyan-300">
          View team →
        </Link>
      }
    >
      {unavailable ? (
        <p className="text-sm text-slate-400">Responder records are unavailable.</p>
      ) : responders.length ? (
        <ul className="flex flex-wrap gap-4">
          {responders.map((responder) => (
            <li
              key={responder.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2"
            >
              <span
                className={`h-2 w-2 rounded-full ${responder.availability === "available" ? "bg-emerald-400" : "bg-amber-400"}`}
              />
              <span className="text-sm">{responder.name}</span>
              <span className="text-xs text-slate-400">{responder.organization}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">
          No approved responders in this session yet.
        </p>
      )}
    </Panel>
  );
}
