import express from "express";
import { exchangeToken, requireServiceToken } from "./auth.js";
import { projectsRouter } from "./routes/projects.js";
import { ticketsRouter } from "./routes/tickets.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Échange API Token -> Ticket Service Token. Le token d'API est fourni
// explicitement par Claude (via le tool `authenticate` du MCP), pas
// injecté automatiquement : il doit être obtenu par l'utilisateur
// auprès du système Ticket, comme une vraie clé d'API.
app.post("/auth/exchange", (req, res) => {
  const apiToken = req.body?.apiToken;
  if (typeof apiToken !== "string") {
    res.status(400).json({ error: "missing_api_token" });
    return;
  }

  const result = exchangeToken(apiToken);
  if (!result) {
    res.status(403).json({ error: "invalid_api_token" });
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
