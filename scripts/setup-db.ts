/**
 * npm run db:setup  -> apply migrations, enable Tiger/TimescaleDB extras, seed demo data.
 * npm run db:setup -- --reset  -> same, then wipe agents/runs and re-seed the inbox.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { sql } = await import("../src/lib/db");
  const { runSetup } = await import("../src/lib/setup");
  const { resetDemo } = await import("../src/lib/seed");

  await runSetup();
  if (process.argv.includes("--reset")) {
    await resetDemo();
    console.log("Demo data reset.");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
