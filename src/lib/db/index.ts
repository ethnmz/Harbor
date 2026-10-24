import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { harborSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at Tiger Cloud.");
  }
  // prepare:false keeps us compatible with Tiger's connection pooler (transaction mode).
  return postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
}

export const sql = globalForDb.harborSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.harborSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
