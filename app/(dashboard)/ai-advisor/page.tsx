import { redirect } from "next/navigation";

/** Keep older advisor links on the shared, provider-backed planner. */
export default function AiAdvisorPage() {
  redirect("/ai-planner");
}
