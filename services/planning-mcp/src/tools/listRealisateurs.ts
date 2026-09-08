import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

export function registerListRealisateurs(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "list_realisateurs",
    {
      title: "Lister les réalisateurs",
      description:
        "Liste les réalisateurs (salariés) connus, avec leur id — utile pour résoudre un nom vers " +
        "l'id attendu par create_planning_event (realisateurId).",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const realisateurs = await client.listRealisateurs();
        return textResult(realisateurs);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
