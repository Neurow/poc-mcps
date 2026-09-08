import express from "express";
import { exchangeToken, requireServiceToken } from "./auth.js";
import { realisateursRouter } from "./routes/realisateurs.js";
import { reportsRouter } from "./routes/reports.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

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

app.use("/reports", requireServiceToken, reportsRouter);
app.use("/realisateurs", requireServiceToken, realisateursRouter);

const port = Number(process.env.PORT ?? 4003);
app.listen(port, () => {
  console.log(`[report-api] listening on :${port}`);
});
