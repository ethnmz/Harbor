/** The shape a server value takes after a JSON round-trip (Dates become strings). */
export type Jsonified<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonified<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonified<T[K]> }
      : T;

export function toJson<T>(v: T): Jsonified<T> {
  return JSON.parse(JSON.stringify(v));
}
