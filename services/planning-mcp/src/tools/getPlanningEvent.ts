import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerGetPlanningEvent(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "get_planning_event",
    {
      title: "Obtenir un événement de planning",
      description: "Récupère le détail d'un événement de planning à partir de son id.",
      inputSchema: {
        id: z.string().describe("Identifiant de l'événement"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const event = await client.getEvent(id);
        if (!event) return errorResult(`Aucun événement trouvé avec l'id ${id}`);
        return textResult(event);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
