import express from "express";
import { exchangeToken, requireServiceToken } from "./auth.js";
import { projectsRouter } from "./routes/projects.js";
import { ticketsRouter } from "./routes/tickets.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Échange Portal Token -> Ticket Service Token (session propre à Ticket
// API). Le portal token est fourni explicitement par Claude (via le tool
// `authenticate` du MCP), jamais injecté automatiquement.
app.post("/auth/exchange", (req, res) => {
  const portalToken = req.body?.portalToken;
  if (typeof portalToken !== "string") {
    res.status(400).json({ error: "missing_portal_token" });
    return;
  }

  const result = exchangeToken(portalToken);
  if (!result) {
    res.status(403).json({ error: "invalid_portal_token" });
    return;
  }

  res.json(result);
});

app.use("/projects", requireServiceToken, projectsRouter);
app.use("/tickets", requireServiceToken, ticketsRouter);

const port = Number(process.env.PORT ?? 4001);
app.listen(port, () => {
  console.log(`[ticket-api] listening on :${port}`);
});
