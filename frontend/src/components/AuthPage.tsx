import { SignIn, SignUp } from "@clerk/react";

/** Clerk's card, repainted in the PitchPress palette. */
const appearance = {
  variables: {
    colorPrimary: "#ff5a1f",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#fbf8f1",
    colorForeground: "#1c1a16",
    colorMutedForeground: "#6f6a5d",
    colorMuted: "#ebe4d4",
    colorInput: "#ffffff",
    colorInputForeground: "#1c1a16",
    colorBorder: "#d9d1bf",
    colorRing: "#ff5a1f",
    colorDanger: "#b4232f",
    colorSuccess: "#2f6b4f",
    borderRadius: "12px",
    fontFamily: '"Schibsted Grotesk", "Helvetica Neue", sans-serif',
    fontFamilyMono: '"JetBrains Mono", ui-monospace, monospace',
  },
  elements: {
    cardBox: { boxShadow: "none", border: "1px solid #d9d1bf" },
    card: { boxShadow: "none", backgroundColor: "#fbf8f1" },
    headerTitle: { fontFamily: '"Instrument Serif", Georgia, serif', fontSize: "30px", fontWeight: 400 },
    footer: { background: "transparent" },
  },
};

type Props = {
  mode: "sign-in" | "sign-up";
  onHome: () => void;
};

export function AuthPage({ mode, onHome }: Props) {
  const isSignUp = mode === "sign-up";

  return (
    <div className="auth">
      {/* Left: the pitch. Hidden on small screens so the form gets the space. */}
      <aside className="auth-brand">
        <button type="button" className="wordmark auth-wordmark" onClick={onHome}>
          Pitch<em>Press</em>
        </button>

        <div className="auth-brand-copy">
          <h1 className="auth-headline">
            Your idea,
            <br />
            <em>printed</em> as a pitch deck.
          </h1>
          <ul className="auth-points">
            <li>One sentence in, seven illustrated slides out</li>
            <li>Watch every step of the job as it runs</li>
            <li>Present full screen, with a highlighter for the room</li>
          </ul>
        </div>

        <span className="mono auth-foot">Your decks stay private to your account</span>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <p className="mono auth-kicker">{isSignUp ? "Create your account" : "Welcome back"}</p>

          {isSignUp ? (
            // New accounts land on the home page, where the idea box is
            <SignUp routing="hash" signInUrl="/?auth=sign-in" fallbackRedirectUrl="/" appearance={appearance} />
          ) : (
            // Returning users go straight to their decks
            <SignIn routing="hash" signUpUrl="/?auth=sign-up" fallbackRedirectUrl="/?app=1" appearance={appearance} />
          )}

          <button type="button" className="landing-link auth-back" onClick={onHome}>
            ← Back to the home page
          </button>
        </div>
      </main>
    </div>
  );
}
