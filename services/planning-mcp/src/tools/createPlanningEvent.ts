import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlanningApiClient } from "../planningApiClient.js";
import { errorResult, textResult } from "./shared.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function registerCreatePlanningEvent(server: McpServer, client: PlanningApiClient) {
  server.registerTool(
    "create_planning_event",
    {
      title: "Planifier un événement",
      description:
        "Planifie un événement (créneau de travail ou réunion) sur un ticket, pour un réalisateur " +
        "donné. Opération d'écriture : demander confirmation à l'utilisateur avant d'appeler cet outil.",
      inputSchema: {
        ticketId: z.string().describe("Identifiant du ticket concerné"),
        realisateurId: z.string().describe("Id du réalisateur qui planifie (voir list_realisateurs)"),
        title: z.string().min(1),
        date: z.string().regex(DATE_RE).describe("Date au format YYYY-MM-DD"),
        startTime: z.string().describe("Heure de début, ex: 09:00"),
        endTime: z.string().describe("Heure de fin, ex: 10:30"),
        type: z.enum(["work", "meeting"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ ticketId, realisateurId, title, date, startTime, endTime, type }) => {
      try {
        const event = await client.createEvent({ ticketId, realisateurId, title, date, startTime, endTime, type });
        return textResult(event);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    }
  );
}
