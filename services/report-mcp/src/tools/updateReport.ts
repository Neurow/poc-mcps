import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const TIME_RE = /^\d{2}:\d{2}$/;

const entrySchema = z.object({
  ticketId: z.string().min(1).describe("Identifiant du ticket concerné"),
  startTime: z.string().regex(TIME_RE).describe("Heure de début, format HH:mm"),
  endTime: z.string().regex(TIME_RE).describe("Heure de fin, format HH:mm"),
  description: z.string().optional().describe("Description courte du travail effectué"),
});

export function registerUpdateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "update_report",
    {
      title: "Mettre à jour un rapport",
      description:
        "Met à jour le contenu, le statut et/ou les créneaux de travail (`entries`) d'un rapport " +
        "existant. Si `entries` est fourni, il remplace entièrement les créneaux existants (pas de " +
        "fusion partielle). Opération d'écriture : demander confirmation à l'utilisateur avant " +
        "d'appeler cet outil, en lui présentant le contenu proposé.",
      inputSchema: {
        id: z.string().describe("Identifiant du rapport"),
        entries: z.array(entrySchema).optional().describe("Créneaux de travail par ticket (remplace les existants)"),
        content: z.string().min(1).optional(),
        status: z.enum(["draft", "submitted"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, entries, content, status }) => {
      try {
        const report = await client.updateReport(id, { content, status, entries });
        if (!report) return errorResult(`Aucun rapport trouvé avec l'id ${id}`);
        return textResult(report);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
