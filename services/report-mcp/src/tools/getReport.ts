import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerGetReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "get_report",
    {
      title: "Obtenir le rapport d'un jour",
      description: "Récupère le rapport existant d'un réalisateur pour une date donnée, s'il existe.",
      inputSchema: {
        realisateurId: z.string().describe("Id du réalisateur (voir list_realisateurs)"),
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ realisateurId, date }) => {
      try {
        const report = await client.getReport(realisateurId, date);
        if (!report) return errorResult(`Aucun rapport trouvé pour le ${date}`);
        return textResult(report);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
