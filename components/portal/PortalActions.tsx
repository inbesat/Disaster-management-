"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignReport,
  claimReport,
  checkInReport,
  completeResponderTraining,
  saveResponderProfile,
  setResponderApproval,
  setResponderAvailability,
  setResponderTier,
  setReportPriority,
  submitFieldVerdict,
} from "@/app/actions/field-portal";
import {
  demoCheckInReport,
  resetReportWave,
  seedReportWave,
} from "@/app/actions/portal-demo";

function Feedback({ message }: { message: string }) {
  return message ? (
    <p role="status" className="mt-2 text-sm text-cyan-200">
      {message}
    </p>
  ) : null;
}

export function ClaimButton({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await claimReport(id);
          setMessage(r.message);
          setBusy(false);
          if (r.ok) router.refresh();
        }}
        className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-50"
      >
        {busy ? "Claiming…" : "Claim report"}
      </button>
      <Feedback message={message} />
    </div>
  );
}

export function CheckInButton({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div>
      <button
        disabled={busy}
        onClick={() => {
          if (!navigator.geolocation)
            return setMessage("GPS is unavailable on this device.");
          setBusy(true);
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const r = await checkInReport(
                id,
                pos.coords.latitude,
                pos.coords.longitude,
              );
              setMessage(r.message);
              setBusy(false);
              if (r.ok) router.refresh();
            },
            () => {
              setMessage("Allow location access and try again.");
              setBusy(false);
            },
            { enableHighAccuracy: true, timeout: 15000 },
          );
        }}
        className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
      >
        {busy ? "Checking location…" : "Check in with GPS"}
      </button>
      <Feedback message={message} />
    </div>
  );
}

export function DemoCheckInButton({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={async () => {
          const r = await demoCheckInReport(id);
          setMessage(r.message);
          if (r.ok) router.refresh();
        }}
        className="rounded-xl border border-amber-400 px-4 py-3 text-sm text-amber-200"
      >
        Simulate arrival for demo
      </button>
      <Feedback message={message} />
    </div>
  );
}

export function DemoWaveButtons() {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div className="mt-5 rounded-xl border border-amber-400/40 bg-amber-950/20 p-4">
      <p className="font-bold text-amber-200">Isolated demo scenario</p>
      <p className="mt-1 text-sm text-slate-300">
        Add eight labeled public reports to this demo session, then switch between
        citizen, field and government views.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          onClick={async () => {
            const r = await seedReportWave();
            setMessage(r.message);
            if (r.ok) router.refresh();
          }}
          className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-950"
        >
          Add report wave
        </button>
        <button
          onClick={async () => {
            const r = await resetReportWave();
            setMessage(r.message);
            if (r.ok) router.refresh();
          }}
          className="rounded-lg border border-amber-400 px-4 py-2 text-amber-200"
        >
          Reset wave
        </button>
      </div>
      <Feedback message={message} />
    </div>
  );
}

export function VerdictForm({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState("verified");
  const [note, setNote] = useState("");
  const router = useRouter();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await submitFieldVerdict(id, new FormData(e.currentTarget));
        setMessage(r.message);
        setBusy(false);
        if (r.ok) router.refresh();
      }}
    >
      <label className="block text-sm">
        Verdict
        <select
          name="verdict"
          required
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
        >
          <option value="verified">Verified on site</option>
          <option value="partially_true">Partially true</option>
          <option value="rejected">Could not confirm / false report</option>
          <option value="escalated">Escalate to government</option>
        </select>
      </label>
      {verdict === "escalated" && (
        <label className="block text-sm">
          Escalation reason
          <select
            name="escalationReason"
            required
            className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
          >
            <option value="">Select a reason</option>
            <option value="people_trapped">People trapped</option>
            <option value="rescue_equipment">Rescue equipment needed</option>
            <option value="medical_emergency">Medical emergency</option>
            <option value="road_impassable">Road impassable</option>
            <option value="shelter_capacity">Shelter at capacity</option>
          </select>
        </label>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() =>
            setNote(
              "Flooding confirmed. Road is impassable for vehicles; pedestrians should avoid the area.",
            )
          }
          className="rounded-lg border border-white/20 px-2 py-1"
        >
          Flooding note
        </button>
        <button
          type="button"
          onClick={() =>
            setNote(
              "Road is open to pedestrians but blocked to vehicles. Conditions differ from the original report.",
            )
          }
          className="rounded-lg border border-white/20 px-2 py-1"
        >
          Partial note
        </button>
      </div>
      <label className="block text-sm">
        What did you observe?
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={15}
          maxLength={2000}
          required
          rows={4}
          className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
          placeholder="Describe people affected, visible conditions, and action taken."
        />
      </label>
      <label className="block text-sm">
        Evidence photo{" "}
        {verdict === "verified" || verdict === "rejected" ? "(required)" : "(optional)"} ·
        JPG/PNG/WebP under 5 MB
        <input
          name="evidence"
          type="file"
          capture="environment"
          required={verdict === "verified" || verdict === "rejected"}
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm"
        />
      </label>
      <button
        disabled={busy}
        className="w-full rounded-xl bg-cyan-400 p-3 font-bold text-slate-950 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Submit signed observation"}
      </button>
      <Feedback message={message} />
    </form>
  );
}

export function ProfileForm({
  profile,
}: {
  profile?: {
    name: string;
    organization: string;
    organizationType: string;
    district: string;
    phone: string | null;
    designation: string | null;
    badgeId: string | null;
    serviceRadiusKm: number;
  } | null;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveResponderProfile(new FormData(e.currentTarget));
        setMessage(r.message);
        setBusy(false);
        if (r.ok) router.refresh();
      }}
    >
      {(
        [
          ["name", "Full name", profile?.name],
          ["organization", "Organization", profile?.organization],
          ["district", "District", profile?.district],
          ["phone", "Phone", profile?.phone],
          ["designation", "Designation", profile?.designation],
          ["badgeId", "Badge or registration ID (reviewed by admin)", profile?.badgeId],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name} className="block text-sm">
          {label}
          <input
            name={name}
            defaultValue={value ?? ""}
            required={["name", "organization", "district"].includes(name)}
            className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
          />
        </label>
      ))}
      <label className="block text-sm">
        Organization type
        <select
          name="organizationType"
          defaultValue={profile?.organizationType ?? "ngo"}
          className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
        >
          {[
            "ngo",
            "police",
            "ndrf",
            "sdrf",
            "medical",
            "civil_defence",
            "volunteer",
            "other",
          ].map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Service radius (km)
        <input
          name="serviceRadiusKm"
          type="number"
          min={1}
          max={200}
          defaultValue={profile?.serviceRadiusKm ?? 20}
          className="mt-1 w-full rounded-lg border border-white/20 bg-slate-800 p-3"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          disabled={busy}
          className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

export function TrainingButton() {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        onClick={async () => {
          const r = await completeResponderTraining();
          setMessage(r.message);
          if (r.ok) router.refresh();
        }}
        className="rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950"
      >
        I understand the verification rules
      </button>
      <Feedback message={message} />
    </div>
  );
}

export function TierSelect({ id, value }: { id: string; value: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <label className="text-sm">
        Verification tier
        <select
          defaultValue={value}
          onChange={async (e) => {
            const r = await setResponderTier(
              id,
              e.target.value as "probation" | "approved" | "trusted",
            );
            setMessage(r.message);
            if (r.ok) router.refresh();
          }}
          className="ml-2 rounded-lg border border-white/20 bg-slate-800 p-2"
        >
          {["probation", "approved", "trusted"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <Feedback message={message} />
    </div>
  );
}

export function AvailabilityButton({ available }: { available: boolean }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        onClick={async () => {
          const r = await setResponderAvailability(
            available ? "unavailable" : "available",
          );
          setMessage(r.message);
          if (r.ok) router.refresh();
        }}
        className="rounded-xl border border-cyan-400 px-4 py-2 text-cyan-200"
      >
        Mark {available ? "unavailable" : "available"}
      </button>
      <Feedback message={message} />
    </div>
  );
}

export function ApprovalButtons({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {(["approved", "rejected"] as const).map((d) => (
        <button
          key={d}
          onClick={async () => {
            const r = await setResponderApproval(id, d);
            setMessage(r.message);
            if (r.ok) router.refresh();
          }}
          className="rounded-lg border border-white/20 px-3 py-2 capitalize"
        >
          {d}
        </button>
      ))}
      <Feedback message={message} />
    </div>
  );
}

export function PrioritySelect({ id, value }: { id: string; value: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div>
      <select
        aria-label="Report priority"
        defaultValue={value}
        onChange={async (e) => {
          const r = await setReportPriority(
            id,
            e.target.value as "normal" | "high" | "critical",
          );
          setMessage(r.message);
          if (r.ok) router.refresh();
        }}
        className="rounded-lg border border-white/20 bg-slate-800 p-2"
      >
        {["normal", "high", "critical"].map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <Feedback message={message} />
    </div>
  );
}

export function AssignmentForm({
  id,
  responders,
}: {
  id: string;
  responders: Array<{ id: string; name: string; organization: string }>;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!responders.length)
    return <p className="text-xs text-slate-400">No approved, available responders.</p>;
  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const r = await assignReport(id, String(form.get("responder")));
        setMessage(r.message);
        if (r.ok) router.refresh();
      }}
    >
      <select
        name="responder"
        aria-label="Assign responder"
        className="min-w-0 rounded-lg border border-white/20 bg-slate-800 p-2 text-sm"
      >
        {responders.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} · {r.organization}
          </option>
        ))}
      </select>
      <button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">
        Assign
      </button>
      <Feedback message={message} />
    </form>
  );
}
