"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { disputeCitizenVerdict } from "@/app/actions/reports";

export default function DisputeButton({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await disputeCitizenVerdict(id);
          setMessage(r.message);
          setBusy(false);
          if (r.ok) router.refresh();
        }}
        className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50"
      >
        {busy ? "Sending…" : "I disagree — request another review"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-sm text-amber-200">
          {message}
        </p>
      )}
    </div>
  );
}
