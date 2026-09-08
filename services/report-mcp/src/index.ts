import { buildApp } from "./httpServer.js";

const port = Number(process.env.PORT ?? 3103);
const app = buildApp();

app.listen(port, () => {
  console.log(`[report-mcp] listening on :${port}`);
});
