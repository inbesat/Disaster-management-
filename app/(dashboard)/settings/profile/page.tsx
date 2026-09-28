import { cookies } from "next/headers";
import ProfileSettings from "@/components/settings/ProfileSettings";

export default function ProfilePage() {
  const store = cookies();
  const scope = store.get("demo_session_id")?.value ?? "local";
  return (
    <ProfileSettings
      storageKey={`safesphere:profile:v1:${scope}`}
      role={store.get("role")?.value ?? "public"}
    />
  );
}
