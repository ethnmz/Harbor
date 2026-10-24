import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;
type Db = PostgresJsDatabase<typeof schema> & { $client: Sql };

const cache = globalThis as unknown as { harborSql?: Sql; harborDb?: Db };

function client(): Sql {
  if (!cache.harborSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and point it at Tiger Cloud.");
    const { hostname, searchParams } = new URL(url);
    const local = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const sslInUrl = searchParams.has("sslmode") || searchParams.has("ssl");
    cache.harborSql = postgres(url, {
      prepare: false, // compatible with Tiger's connection pooler (transaction mode)
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      // Tiger Cloud requires TLS; don't depend on the pasted URL including ?sslmode=require.
      ...(!local && !sslInUrl ? { ssl: "require" as const } : {}),
    });
  }
  return cache.harborSql;
}

function database(): Db {
  if (!cache.harborDb) cache.harborDb = drizzle(client(), { schema });
  return cache.harborDb;
}

function bound<T extends object>(target: T, prop: PropertyKey) {
  const value = Reflect.get(target, prop);
  return typeof value === "function" ? value.bind(target) : value;
}

// Both are created on first use, not at import: `next build` imports every route to
// collect page config, and must succeed even when DATABASE_URL isn't available yet.
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _this, args: unknown[]) => (client() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_target, prop) => bound(client(), prop),
});

export const db = new Proxy({} as Db, {
  get: (_target, prop) => bound(database(), prop),
});

export { schema };
