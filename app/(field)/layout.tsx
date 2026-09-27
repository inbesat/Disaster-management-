import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import FieldShell from "@/components/field/FieldShell";

export default async function FieldLayout({ children }: { children: ReactNode }) {
  const guest = cookies().get("guest_mode")?.value === "true";
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = "Responder";
  let district = "District not assigned";
  let team = "Field team";

  if (user && !guest) {
    const meta = user.user_metadata ?? {};
    const profileName = (meta.name as string) || (meta.full_name as string);
    if (profileName) name = profileName;

    const { data: profile } = await supabase
      .from("users")
      .select("organization, assigned_district")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.assigned_district) district = profile.assigned_district;
    if (profile?.organization) team = profile.organization;
  }

  return (
    <FieldShell profile={{ name, role: "Field Responder", district, team }}>
      {children}
    </FieldShell>
  );
}
