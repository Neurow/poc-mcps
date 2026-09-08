import { buildApp } from "./httpServer.js";

const port = Number(process.env.PORT ?? 3101);
const app = buildApp();

app.listen(port, () => {
  console.log(`[ticket-mcp] listening on :${port}`);
});
