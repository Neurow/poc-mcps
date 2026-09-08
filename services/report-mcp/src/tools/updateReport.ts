import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const entrySchema = z.object({
  ticketId: z.string().min(1).describe("Identifiant du ticket concerné (un ticket = une entrée)"),
  date: z.string().datetime().describe("Début précis de la tâche, ISO 8601 UTC (ex: 2026-09-07T09:00:00Z)"),
  duration: z.number().int().positive().describe("Durée du travail en minutes"),
  description: z.string().optional().describe("Description courte du travail effectué"),
});

export function registerUpdateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "update_report",
    {
      title: "Mettre à jour un rapport",
      description:
        "Met à jour le contenu, le statut et/ou les entrées de travail (`entries`) d'un rapport " +
        "existant. Si `entries` est fourni, il remplace entièrement les entrées existantes (pas de " +
        "fusion partielle). Opération d'écriture : demander confirmation à l'utilisateur avant " +
        "d'appeler cet outil, en lui présentant le contenu proposé.",
      inputSchema: {
        id: z.string().describe("Identifiant du rapport"),
        entries: z.array(entrySchema).optional().describe("Une entrée par ticket travaillé (remplace les existantes)"),
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
