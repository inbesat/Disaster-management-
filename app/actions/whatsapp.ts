"use server";

// ---------------------------------------------------------------------
// app/actions/whatsapp.ts — citizen opt-in for WhatsApp district alerts.
//
// Called by the public dashboard's "Get WhatsApp Alerts" button. The
// citizen's identity is the httpOnly `citizen_phone` cookie (the same
// cookie the rest of the public portal uses). The preference is upserted
// into `user_settings` keyed by phone. If the table isn't migrated yet
// (or Supabase is unreachable) we degrade to a mock success — the local
// `citizen_notification_prefs` store still applies for this browser —
// mirroring the pattern used by sendFeedback in app/actions/alerts.ts.
// ---------------------------------------------------------------------

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type EnableWhatsAppAlertsResult = {
  ok: boolean;
  phone: string;
  error?: string;
};

export async function enableWhatsAppAlerts(): Promise<EnableWhatsAppAlertsResult> {
  const phone = cookies().get("citizen_phone")?.value ?? "";
  if (!/^\+?[0-9]{10,15}$/.test(phone)) {
    return { ok: false, phone: "", error: "A valid phone number is required" };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.from("user_settings").upsert(
      {
        phone,
        whatsapp_alerts: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    );

    if (error) {
      console.warn(
        "[whatsapp] could not persist whatsapp_alerts (table may be un-migrated).",
        error.message,
      );
      return { ok: false, phone, error: error.message };
    }

    return { ok: true, phone };
  } catch (error: unknown) {
    console.warn("[whatsapp] server sync failed:", error);
    return {
      ok: false,
      phone,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
