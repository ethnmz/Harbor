/** Timeouts and retries for LLM calls that a live demo must never hang on. */
export class TimeoutError extends Error {}

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms / 1000}s`)), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

/** Try `fn` up to `attempts` times, each bounded by `ms`. Throws the last error. */
export async function retrying<T>(fn: () => Promise<T>, opts: { attempts?: number; ms: number; label: string }): Promise<T> {
  let last: unknown;
  for (let i = 0; i < (opts.attempts ?? 2); i++) {
    try {
      return await withTimeout(fn(), opts.ms, opts.label);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
