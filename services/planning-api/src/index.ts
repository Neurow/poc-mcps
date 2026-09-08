import express from "express";
import { exchangeToken, requireServiceToken } from "./auth.js";
import { planningRouter } from "./routes/planning.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

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

app.use("/planning", requireServiceToken, planningRouter);

const port = Number(process.env.PORT ?? 4002);
app.listen(port, () => {
  console.log(`[planning-api] listening on :${port}`);
});
