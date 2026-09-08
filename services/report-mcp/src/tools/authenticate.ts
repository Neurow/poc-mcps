import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "../auth/tokenManager.js";
import { errorResult, textResult } from "./shared.js";

export function registerAuthenticate(server: McpServer, tokenManager: TokenManager) {
  server.registerTool(
    "authenticate",
    {
      title: "S'authentifier auprès de Report API",
      description:
        "Fournit le token d'accès à Report API (obtenu par l'utilisateur auprès du système Report) " +
        "pour permettre les appels des autres outils. À appeler avant toute autre opération sur ce " +
        "serveur, ou de nouveau si un outil échoue avec une erreur d'authentification.",
      inputSchema: {
        token: z.string().min(1).describe("Token d'accès délivré par Report API"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ token }) => {
      try {
        const { expiresAt } = await tokenManager.authenticate(token);
        return textResult({ authenticated: true, expiresAt: new Date(expiresAt).toISOString() });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
