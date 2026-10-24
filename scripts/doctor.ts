/**
 * npm run doctor            -> check database, Tiger/TimescaleDB, model, SerpApi and Slack config
 * npm run doctor -- --slack -> also send a test message to Slack
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const d = await import("../src/lib/diagnostics");
  const checks = [
    ...(await d.checkDatabase()),
    await d.checkModel(),
    await d.checkSerpApi(),
    await d.checkSlack(process.argv.includes("--slack")),
    d.checkAppUrl(),
  ];
  const icon = { pass: "✅", warn: "⚠️ ", fail: "❌" } as const;
  console.log("\nHarbor doctor\n");
  for (const c of checks) {
    console.log(`${icon[c.status]} ${c.name.padEnd(14)} ${c.detail}`);
    if (c.fix && c.status !== "pass") console.log(`   ${"".padEnd(14)} → ${c.fix}`);
  }
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  console.log(`\n${failed ? `${failed} failing` : "No failures"}${warned ? `, ${warned} running in simulated mode` : ""}.\n`);
  if (process.env.DATABASE_URL) (await import("../src/lib/db")).sql.end();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
