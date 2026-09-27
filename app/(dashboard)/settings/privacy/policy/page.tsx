import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, FileText, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        href="/settings/privacy"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Privacy Settings
      </Link>

      <div className="rounded-lg border border-panel-border bg-panel p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-panel-border pb-4">
          <ShieldCheck className="h-8 w-8 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">SafeSphere Privacy Policy</h1>
            <p className="text-xs text-slate-400">
              Data Privacy & GDPR / DPDP Act 2023 Compliance Statement · Effective Date: January 2025
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-400" /> 1. Overview & Purpose
            </h2>
            <p className="mt-2">
              SafeSphere collects and processes personal data for disaster response, emergency warnings, and life safety coordination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" /> 2. What Data We Collect & Why
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Profile Data:</strong> Email, name, role, assigned district, and verification credentials for authorized disaster response personnel.</li>
              <li><strong>GPS & Location:</strong> Precise GPS coordinates are requested only during active navigation or SOS calls. Public warnings and general overlays use approximate (~11km) location coordinates.</li>
              <li><strong>Emergency Family Contacts:</strong> Designated phone numbers provided by citizens to receive emergency alerts.</li>
              <li><strong>Chat & AI History:</strong> AI emergency response queries and plan generations (retained for up to 30 days for quality assurance, then anonymized or purged).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Retention & Anonymization</h2>
            <p className="mt-2">
              Chat session histories are automatically purged or anonymized after 30 days. Crowdsourced reports are anonymized after 90 days. Demo user data is automatically purged after 24 hours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. User Rights & Data Portability</h2>
            <p className="mt-2">
              Users may request a complete download of their data in machine-readable JSON format or a printable summary. You may also request soft deactivation or permanent account deletion with complete cascade removal of personal records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Do Not Track (DNT) & Analytics</h2>
            <p className="mt-2">
              SafeSphere respects the standard &apos;Do Not Track&apos; browser setting (<code className="text-cyan-300">navigator.doNotTrack</code>). Non-essential analytics cookies are disabled when DNT is signal active or when consent is revoked.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
