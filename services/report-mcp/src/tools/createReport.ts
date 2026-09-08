import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReportApiConflictError, type ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const entrySchema = z.object({
  ticketId: z.string().min(1).describe("Identifiant du ticket concerné (un ticket = une entrée)"),
  date: z.string().datetime().describe("Début précis de la tâche, ISO 8601 UTC (ex: 2026-09-07T09:00:00Z)"),
  duration: z.number().int().positive().describe("Durée du travail en minutes"),
  description: z.string().optional().describe("Description courte du travail effectué"),
});

export function registerCreateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "create_report",
    {
      title: "Créer un rapport",
      description:
        "Crée le rapport d'une date donnée (échoue s'il en existe déjà un — utiliser update_report " +
        "pour le modifier). `entries` porte le détail précis du travail : un ticket = une entrée, " +
        "avec l'heure de début (`date`) et la durée (`duration`, en minutes) — de quoi reconstruire " +
        "toute la journée. `content` reste un résumé libre optionnel en complément. Opération " +
        "d'écriture : demander confirmation à l'utilisateur avant d'appeler cet outil, en lui " +
        "présentant le contenu proposé.",
      inputSchema: {
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
        entries: z.array(entrySchema).optional().describe("Une entrée par ticket travaillé ce jour-là"),
        content: z.string().min(1).optional().describe("Résumé libre du rapport (markdown), optionnel"),
        status: z.enum(["draft", "submitted"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ date, entries, content, status }) => {
      try {
        const report = await client.createReport({ date, content, status, entries });
        return textResult(report);
      } catch (err) {
        if (err instanceof ReportApiConflictError) {
          return errorResult(`${err.message}. Utilise update_report avec cet id pour le modifier.`);
        }
        return errorResult((err as Error).message);
      }
    }
  );
}
