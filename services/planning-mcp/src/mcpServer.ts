import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "./auth/tokenManager.js";
import type { PlanningApiClient } from "./planningApiClient.js";
import { registerAuthenticate } from "./tools/authenticate.js";
import { registerGetPlanningDay } from "./tools/getPlanningDay.js";
import { registerSearchPlanning } from "./tools/searchPlanning.js";
import { registerGetPlanningEvent } from "./tools/getPlanningEvent.js";
import { registerCreatePlanningEvent } from "./tools/createPlanningEvent.js";
import { registerUpdatePlanningEvent } from "./tools/updatePlanningEvent.js";
import { registerListRealisateurs } from "./tools/listRealisateurs.js";

export function createPlanningMcpServer(client: PlanningApiClient, tokenManager: TokenManager): McpServer {
  const server = new McpServer({ name: "planning-mcp", version: "0.1.0" });

  registerAuthenticate(server, tokenManager);
  registerGetPlanningDay(server, client);
  registerSearchPlanning(server, client);
  registerGetPlanningEvent(server, client);
  registerCreatePlanningEvent(server, client);
  registerUpdatePlanningEvent(server, client);
  registerListRealisateurs(server, client);

  return server;
}
