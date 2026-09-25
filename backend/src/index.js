import "dotenv/config";
import express from "express";
import { serve } from "inngest/express";

import { warnIfClerkMissing } from "./lib/auth.ts";
import { inngest } from "./inngest/client.ts";
import { generateDeck, regenerateSlideImage } from "./inngest/functions/index.ts";
import { decksRouter } from "./routes/decks.ts";

const functions = [generateDeck, regenerateSlideImage];

const app = express();

app.use(express.json());

// Auth is mounted inside the deck routes only (see lib/auth.ts), so a missing or
// wrong Clerk key can never take down /health or the Inngest endpoint.
warnIfClerkMissing();

// Inngest calls this endpoint itself — it must stay unauthenticated
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/decks", decksRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Unknown API routes and thrown errors return JSON, so the frontend can always show a message
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ error: status === 500 ? "Something went wrong on the server" : err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
