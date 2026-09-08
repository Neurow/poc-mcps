import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReportApiConflictError, type ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerCreateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "create_report",
    {
      title: "Créer un rapport",
      description:
        "Crée le rapport d'une date donnée (échoue s'il en existe déjà un — utiliser update_report " +
        "pour le modifier). Opération d'écriture : demander confirmation à l'utilisateur avant " +
        "d'appeler cet outil, en lui présentant le contenu proposé.",
      inputSchema: {
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
        content: z.string().min(1).describe("Contenu du rapport (markdown)"),
        status: z.enum(["draft", "submitted"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ date, content, status }) => {
      try {
        const report = await client.createReport({ date, content, status });
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
