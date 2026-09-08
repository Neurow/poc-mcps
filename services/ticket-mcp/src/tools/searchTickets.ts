import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketApiClient } from "../ticketApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerSearchTickets(server: McpServer, client: TicketApiClient) {
  server.registerTool(
    "search_tickets",
    {
      title: "Rechercher des tickets",
      description:
        "Recherche des tickets par texte libre, statut et/ou projet. Retourne une liste compacte " +
        "(id, titre, statut, projet, assigné) — utile pour trouver rapidement des tickets sans " +
        "connaître leur id exact.",
      inputSchema: {
        query: z.string().optional().describe("Texte libre recherché dans le titre et la description"),
        status: z.enum(["open", "in_progress", "closed"]).optional(),
        projectKey: z.string().optional().describe("Clé de projet, ex: WEB, MOBILE, API"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, status, projectKey }) => {
      try {
        const tickets = await client.searchTickets({ query, status, projectKey });
        return textResult(tickets);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
