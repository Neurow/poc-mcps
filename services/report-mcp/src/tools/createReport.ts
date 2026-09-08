import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReportApiConflictError, type ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const entrySchema = z.object({
  ticketId: z.string().min(1).describe("Identifiant du ticket concerné"),
  startTime: z.string().regex(TIME_RE).describe("Heure de début, format HH:mm"),
  endTime: z.string().regex(TIME_RE).describe("Heure de fin, format HH:mm"),
  description: z.string().optional().describe("Description courte du travail effectué"),
});

export function registerCreateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "create_report",
    {
      title: "Créer un rapport",
      description:
        "Crée le rapport d'une date donnée (échoue s'il en existe déjà un — utiliser update_report " +
        "pour le modifier). `entries` porte le détail précis \"de telle heure à telle heure, sur tel " +
        "ticket\" ; `content` reste un résumé libre optionnel en complément. Opération d'écriture : " +
        "demander confirmation à l'utilisateur avant d'appeler cet outil, en lui présentant le " +
        "contenu proposé.",
      inputSchema: {
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
        entries: z.array(entrySchema).optional().describe("Créneaux de travail par ticket"),
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
