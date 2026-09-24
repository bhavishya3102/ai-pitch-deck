import { clerkMiddleware, getAuth } from "@clerk/express";

const secretKey = process.env.CLERK_SECRET_KEY?.trim() ?? "";
const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? "";

/**
 * Keys are checked for shape up front. A malformed key makes Clerk throw on
 * every request, so it is better to treat it as "not configured" and say so.
 */
export const clerkConfigured = secretKey.startsWith("sk_") && publishableKey.startsWith("pk_");

export function warnIfClerkMissing() {
  if (clerkConfigured) return;

  const problem = !secretKey || !publishableKey ? "missing" : "malformed (expected sk_... and pk_...)";
  console.error(
    `Clerk keys are ${problem} in backend/.env — /api/decks will return 503 until they are set.\n` +
      "Copy them from https://dashboard.clerk.com → API keys:\n" +
      "  CLERK_PUBLISHABLE_KEY=pk_test_...\n" +
      "  CLERK_SECRET_KEY=sk_test_...",
  );
}

/**
 * Only signed-in users reach the deck routes. The Clerk user id is put on
 * req.userId, and every deck query scopes to it.
 */
function requireUser(req, res, next) {
  if (!clerkConfigured) {
    res.status(503).json({ error: "Authentication is not configured on the server (Clerk keys missing)." });
    return;
  }

  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated || !userId) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }

  req.userId = userId;
  next();
}

/**
 * Clerk throws (not 401) when a key is wrong for the instance — turn that into a
 * readable 503 instead of a generic server error.
 */
function safeClerkMiddleware(req, res, next) {
  clerkMiddleware()(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    console.error("Clerk could not verify the request:", error.message);
    res.status(503).json({ error: "Authentication could not start — check the Clerk keys in backend/.env." });
  });
}

/**
 * Mounted only on the deck routes, so /health and the Inngest endpoint keep
 * working even when the keys are wrong.
 */
export const authGuard = clerkConfigured ? [safeClerkMiddleware, requireUser] : [requireUser];
