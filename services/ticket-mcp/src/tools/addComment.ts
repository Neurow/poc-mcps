import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TicketApiClient } from "../ticketApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerAddComment(server: McpServer, client: TicketApiClient) {
  server.registerTool(
    "add_comment",
    {
      title: "Ajouter un commentaire",
      description:
        "Ajoute un commentaire à un ticket existant. Opération d'écriture : demander confirmation " +
        "à l'utilisateur avant d'appeler cet outil.",
      inputSchema: {
        id: z.string().describe("Identifiant du ticket"),
        authorId: z.string().describe("Id de l'auteur du commentaire (voir list_realisateurs)"),
        body: z.string().min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ id, authorId, body }) => {
      try {
        const ticket = await client.addComment(id, { authorId, body });
        if (!ticket) return errorResult(`Aucun ticket trouvé avec l'id ${id}`);
        return textResult(ticket);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
