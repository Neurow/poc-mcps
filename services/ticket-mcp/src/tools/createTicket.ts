import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketApiClient } from "../ticketApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerCreateTicket(server: McpServer, client: TicketApiClient) {
  server.registerTool(
    "create_ticket",
    {
      title: "Créer un ticket",
      description:
        "Crée un nouveau ticket dans un projet donné. Opération d'écriture : demander confirmation " +
        "à l'utilisateur avant d'appeler cet outil.",
      inputSchema: {
        projectKey: z.string().describe("Clé de projet, ex: BACK, WEB, MOBILE"),
        title: z.string().min(3),
        description: z.string().optional(),
        assigneeId: z.string().optional().describe("Id du réalisateur assigné (voir list_realisateurs)"),
        estimatedMinutes: z.number().int().positive().optional().describe("Temps théorique estimé, en minutes"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ projectKey, title, description, assigneeId, estimatedMinutes }) => {
      try {
        const ticket = await client.createTicket({ projectKey, title, description, assigneeId, estimatedMinutes });
        return textResult(ticket);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
