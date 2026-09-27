from pathlib import Path
p=Path('app/actions/whatsapp.ts');s=p.read_text(encoding='utf-8')
s=s.replace('''  const phone = cookies().get("citizen_phone")?.value ?? "";

  try {''','''  const phone = cookies().get("citizen_phone")?.value ?? "";
  if (!/^\\+?[0-9]{10,15}$/.test(phone)) {
    return { ok: false, phone: "", error: "A verified phone number is required" };
  }

  try {''')
s=s.replace('return { ok: true, phone, error: error.message };','return { ok: false, phone, error: error.message };')
s=s.replace('''      ok: true,
      phone,
      error: error instanceof Error ? error.message : "Unknown error",''','''      ok: false,
      phone,
      error: error instanceof Error ? error.message : "Unknown error",''')
p.write_text(s,encoding='utf-8')
p=Path('components/public/lifelines/EvacuationLifelines.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('''const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_SOS_NUMBER ?? "919999999999";''','''const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_SOS_NUMBER ?? "";
const WHATSAPP_SOS_CONFIGURED = /^\\d{10,15}$/.test(WHATSAPP_NUMBER) && WHATSAPP_NUMBER !== "919999999999";''')
s=s.replace('''    try {
      await enableWhatsAppAlerts();
    } catch {
      /* local store still applies below */
    }

    try {''','''    try {
      const result = await enableWhatsAppAlerts();
      if (!result.ok) {
        toast.error("WhatsApp alert preference could not be saved. Alerts are not active.");
        return;
      }
    } catch {
      toast.error("WhatsApp alert preference could not be saved. Alerts are not active.");
      return;
    }

    try {''')
s=s.replace('toast.success("You are now subscribed to district alerts!");','toast.success("Preference saved. WhatsApp delivery is not yet confirmed.");')
s=s.replace('Subscribed to alerts','Preference saved')
s=s.replace('''          <a
            href={sosHref}''','''          {WHATSAPP_SOS_CONFIGURED ? <a
            href={sosHref}''')
s=s.replace('''            SOS via WhatsApp
          </a>''','''            SOS via WhatsApp
          </a> : <p role="status" className="rounded-lg border border-amber-400/40 p-3 text-sm font-semibold text-amber-100">WhatsApp SOS is not configured. Use local emergency contacts directly.</p>}''')
p.write_text(s,encoding='utf-8')
