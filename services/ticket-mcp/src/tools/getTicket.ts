import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketApiClient } from "../ticketApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerGetTicket(server: McpServer, client: TicketApiClient) {
  server.registerTool(
    "get_ticket",
    {
      title: "Obtenir un ticket",
      description: "Récupère le détail complet d'un ticket (y compris ses commentaires) à partir de son id.",
      inputSchema: {
        id: z.string().describe("Identifiant du ticket"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const ticket = await client.getTicket(id);
        if (!ticket) return errorResult(`Aucun ticket trouvé avec l'id ${id}`);
        return textResult(ticket);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
