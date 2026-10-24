/**
 * npm run db:setup  -> apply migrations, enable Tiger/TimescaleDB extras, seed demo data.
 * npm run db:setup -- --reset  -> same, then wipe agents/runs and re-seed the inbox.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db, sql } = await import("../src/lib/db");
  const { getWorkspace, resetDemo, setupTimescale } = await import("../src/lib/seed");

  console.log("Applying migrations…");
  await migrate(db, { migrationsFolder: "drizzle" });
  await setupTimescale();
  const ws = await getWorkspace();
  console.log(`Workspace ready: ${ws.name}`);
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
