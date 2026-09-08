import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerGetPlanningDay(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "get_planning_day",
    {
      title: "Obtenir le planning d'un jour",
      description:
        "Récupère tous les événements de planning d'une journée donnée, tous projets confondus. " +
        "Utile pour reconstituer le travail effectué un jour précis (ex: la veille).",
      inputSchema: {
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ date }) => {
      try {
        const events = await client.getDay(date);
        return textResult(events);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
