/**
 * Database setup shared by `npm run db:setup` and the in-app "Set up database" button:
 * apply migrations, enable Tiger/TimescaleDB extras, seed the demo workspace.
 * Every step is idempotent.
 */
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./db";
import { getWorkspace, setupTimescale } from "./seed";
import type { Workspace } from "./db/schema";

export async function runSetup(log: (line: string) => void = console.log) {
  log("Applying migrations…");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await setupTimescale(log);
  const ws = await getWorkspace();
  log(`Workspace ready: ${ws.name}`);
  return ws;
}

export type DbState =
  | { ok: true; ws: Workspace }
  | { ok: false; reason: "missing_url" | "not_setup" | "unreachable"; message: string };

/** Load the workspace, classifying failures so the UI can explain them instead of crashing. */
export async function loadWorkspaceState(): Promise<DbState> {
  if (!process.env.DATABASE_URL) return { ok: false, reason: "missing_url", message: "DATABASE_URL is not set for this deployment." };
  try {
    return { ok: true, ws: await getWorkspace() };
  } catch (e) {
    // Drizzle wraps driver errors ("Failed query: …"); the Postgres code and real reason are on the cause.
    let root = e as Error & { code?: string; cause?: unknown };
    while (root.cause instanceof Error) root = root.cause as typeof root;
    // 42P01 = undefined_table: connected fine, but migrations haven't run.
    if (root.code === "42P01") return { ok: false, reason: "not_setup", message: root.message };
    console.error("Harbor database unavailable:", e);
    return { ok: false, reason: "unreachable", message: root.message || String(e) };
  }
}
