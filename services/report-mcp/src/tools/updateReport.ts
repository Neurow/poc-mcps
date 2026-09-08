import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReportApiClient } from "../reportApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerUpdateReport(server: McpServer, client: ReportApiClient) {
  server.registerTool(
    "update_report",
    {
      title: "Mettre à jour un rapport",
      description:
        "Met à jour le contenu et/ou le statut d'un rapport existant. Opération d'écriture : " +
        "demander confirmation à l'utilisateur avant d'appeler cet outil, en lui présentant le " +
        "contenu proposé.",
      inputSchema: {
        id: z.string().describe("Identifiant du rapport"),
        content: z.string().min(1).optional(),
        status: z.enum(["draft", "submitted"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, content, status }) => {
      try {
        const report = await client.updateReport(id, { content, status });
        if (!report) return errorResult(`Aucun rapport trouvé avec l'id ${id}`);
        return textResult(report);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
