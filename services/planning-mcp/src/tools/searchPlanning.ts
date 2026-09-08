import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerSearchPlanning(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "search_planning",
    {
      title: "Rechercher des événements de planning",
      description:
        "Recherche des événements de planning sur une plage de dates et/ou un projet. Pratique pour " +
        "une vue sur plusieurs jours plutôt qu'une seule journée (voir get_planning_day pour un seul jour).",
      inputSchema: {
        from: z.string().regex(DATE_RE).optional().describe("Date de début (YYYY-MM-DD), incluse"),
        to: z.string().regex(DATE_RE).optional().describe("Date de fin (YYYY-MM-DD), incluse"),
        projectKey: z.string().optional().describe("Clé de projet, ex: BACK, WEB, MOBILE"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ from, to, projectKey }) => {
      try {
        const events = await client.searchEvents({ from, to, projectKey });
        return textResult(events);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
