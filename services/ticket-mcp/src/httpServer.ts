import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createTicketMcpServer } from "./mcpServer.js";
import { TicketApiClient } from "./ticketApiClient.js";
import { TokenManager } from "./auth/tokenManager.js";

export function buildApp() {
  const apiBaseUrl = process.env.TICKET_API_URL;
  if (!apiBaseUrl) throw new Error("TICKET_API_URL env var is required");

  const tokenManager = new TokenManager(apiBaseUrl);
  const client = new TicketApiClient(apiBaseUrl, tokenManager);

  const app = express();
  app.use(express.json());

  // Une session MCP (Mcp-Session-Id) == une instance de transport Streamable
  // HTTP. Le serveur MCP et le client Ticket API sont partagés entre
  // sessions (l'état par requête vit dans le transport, pas dans ces objets).
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: no valid session" },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport!);
        },
      });
      transport.onclose = () => {
        if (transport?.sessionId) transports.delete(transport.sessionId);
      };

      const server = createTicketMcpServer(client, tokenManager);
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  return app;
}
