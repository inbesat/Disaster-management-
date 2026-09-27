import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

async function main() {
  const { probeEmergencyPlanner } = await import("../lib/ai/openrouter");
  const report = await probeEmergencyPlanner();
  for (const provider of report.statuses) {
    console.log(
      `${provider.name}: ${provider.detail.status}${provider.detail.statusCode ? ` (HTTP ${provider.detail.statusCode})` : ""}`,
    );
  }
  console.log(`Usable provider: ${report.winner ?? "none"}`);
  if (!report.reachable) process.exitCode = 1;
}

main().catch(() => {
  console.error("Provider probe could not run.");
  process.exitCode = 1;
});
