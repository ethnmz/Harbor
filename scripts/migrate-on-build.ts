/**
 * Runs before `next build` (npm "prebuild"). Every push to the production branch deploys,
 * and the app does not migrate at runtime, so apply pending migrations here. A failure
 * fails the build, which keeps the previous deployment serving instead of a broken one.
 */
import path from "node:path";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("migrate-on-build: DATABASE_URL not set, skipping.");
    return;
  }
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { db, sql } = await import("../src/lib/db");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("migrate-on-build: migrations applied.");
  await sql.end();
}

main().catch((e) => {
  console.error("migrate-on-build failed:", e);
  process.exit(1);
});
