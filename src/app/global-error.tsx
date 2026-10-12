"use client";

/** Last-resort error screen when the root layout itself fails. Shows no error details. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-SG">
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", background: "#f3f2ec", color: "#0b0b0b" }}>
        <title>Something went wrong | Jayden SIM Cards</title>
        <main id="main" style={{ maxWidth: 640, margin: "0 auto", padding: "64px 16px", display: "grid", gap: 16 }}>
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          <p style={{ margin: 0 }}>Nothing you did caused this. Please try again in a moment.</p>
          {error.digest && <p style={{ margin: 0, fontFamily: "monospace", fontSize: 14 }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ justifySelf: "start", minHeight: 44, padding: "8px 20px", fontWeight: 700, background: "#0b0b0b", color: "#ffd400", border: "2px solid #0b0b0b", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
