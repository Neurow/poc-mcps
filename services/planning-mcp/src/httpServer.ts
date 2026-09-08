import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createPlanningMcpServer } from "./mcpServer.js";
import { PlanningApiClient } from "./planningApiClient.js";
import { TokenManager } from "./auth/tokenManager.js";

export function buildApp() {
  const apiBaseUrl = process.env.PLANNING_API_URL;
  if (!apiBaseUrl) throw new Error("PLANNING_API_URL env var is required");

  const portalTokenTtlSeconds = Number(process.env.PORTAL_TOKEN_TTL_SECONDS ?? 4 * 60 * 60);
  const tokenManager = new TokenManager(apiBaseUrl, portalTokenTtlSeconds * 1000);
  const client = new PlanningApiClient(apiBaseUrl, tokenManager);

  const app = express();
  app.use(express.json());

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

      const server = createPlanningMcpServer(client, tokenManager);
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
