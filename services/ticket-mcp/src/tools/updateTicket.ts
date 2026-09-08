import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketApiClient } from "../ticketApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerUpdateTicket(server: McpServer, client: TicketApiClient) {
  server.registerTool(
    "update_ticket",
    {
      title: "Mettre à jour un ticket",
      description:
        "Met à jour le titre, la description et/ou le statut d'un ticket existant. Opération " +
        "d'écriture : demander confirmation à l'utilisateur avant d'appeler cet outil.",
      inputSchema: {
        id: z.string(),
        title: z.string().min(3).optional(),
        description: z.string().optional(),
        status: z.enum(["open", "in_progress", "closed"]).optional(),
        assigneeId: z
          .string()
          .nullable()
          .optional()
          .describe("Id du réalisateur à assigner (voir list_realisateurs), null pour désassigner"),
        estimatedMinutes: z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .describe("Temps théorique estimé, en minutes, null pour l'effacer"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, title, description, status, assigneeId, estimatedMinutes }) => {
      try {
        const ticket = await client.updateTicket(id, { title, description, status, assigneeId, estimatedMinutes });
        if (!ticket) return errorResult(`Aucun ticket trouvé avec l'id ${id}`);
        return textResult(ticket);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
