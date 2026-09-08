import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerUpdatePlanningEvent(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "update_planning_event",
    {
      title: "Reprogrammer un événement",
      description:
        "Change la date, l'horaire et/ou le type d'un événement de planning existant (le ticket et le " +
        "réalisateur ne sont pas modifiables après création). Opération d'écriture : demander " +
        "confirmation à l'utilisateur avant d'appeler cet outil.",
      inputSchema: {
        id: z.string().describe("Identifiant de l'événement"),
        date: z.string().regex(DATE_RE).optional().describe("Date au format YYYY-MM-DD"),
        startTime: z.string().optional().describe("Heure de début, ex: 09:00"),
        endTime: z.string().optional().describe("Heure de fin, ex: 10:30"),
        type: z.enum(["work", "meeting"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, date, startTime, endTime, type }) => {
      try {
        const event = await client.updateEvent(id, { date, startTime, endTime, type });
        if (!event) return errorResult(`Aucun événement trouvé avec l'id ${id}`);
        return textResult(event);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
