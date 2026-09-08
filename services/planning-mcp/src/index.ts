import { buildApp } from "./httpServer.js";

const port = Number(process.env.PORT ?? 3102);
const app = buildApp();

app.listen(port, () => {
  console.log(`[planning-mcp] listening on :${port}`);
});
