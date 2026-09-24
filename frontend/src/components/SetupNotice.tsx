/** Shown instead of a blank screen when the Clerk publishable key is missing. */
export function SetupNotice({ reason = "missing" }: { reason?: "missing" | "invalid" }) {
  return (
    <div className="setup">
      <div className="setup-card">
        <span className="wordmark setup-wordmark">
          Pitch<em>Press</em>
        </span>
        <h1 className="setup-title">{reason === "invalid" ? "That key looks wrong" : "One key away"}</h1>
        <p className="setup-body">
          {reason === "invalid"
            ? "Clerk could not start with that publishable key. Copy it again from "
            : "Sign-in needs a Clerk publishable key. Create a free application at "}
          <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">
            dashboard.clerk.com
          </a>
          , then add this line to <code>frontend/.env</code> and restart <code>npm run dev</code>:
        </p>
        <pre className="setup-code">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</pre>
        <p className="setup-body setup-muted">
          The backend needs the matching pair in <code>backend/.env</code>:<br />
          <code>CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code>.
        </p>
      </div>
    </div>
  );
}
