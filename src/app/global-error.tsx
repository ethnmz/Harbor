"use client";

/** Last resort when even the root layout fails. Keeps the digest visible so it can be matched in the server logs. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#ffffff", margin: 0 }}>
        <div style={{ maxWidth: 520, margin: "12vh auto", background: "#fff", borderRadius: 28, padding: 36 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Harbor hit a server error</h1>
          <p style={{ color: "#6f6f6b", lineHeight: 1.6 }}>
            Check <a href="/api/health">/api/health</a> for what&apos;s misconfigured, and the deployment&apos;s function logs for details.
            {error.digest ? ` Error digest: ${error.digest}.` : ""}
          </p>
          <button onClick={reset} style={{ marginTop: 8, padding: "10px 18px", borderRadius: 999, border: 0, background: "#141414", color: "#fff", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
