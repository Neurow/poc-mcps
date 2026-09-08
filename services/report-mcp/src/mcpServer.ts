import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "./auth/tokenManager.js";
import type { ReportApiClient } from "./reportApiClient.js";
import { registerAuthenticate } from "./tools/authenticate.js";
import { registerGetReport } from "./tools/getReport.js";
import { registerCreateReport } from "./tools/createReport.js";
import { registerUpdateReport } from "./tools/updateReport.js";
import { registerListRealisateurs } from "./tools/listRealisateurs.js";

export function createReportMcpServer(client: ReportApiClient, tokenManager: TokenManager): McpServer {
  const server = new McpServer({ name: "report-mcp", version: "0.1.0" });

  registerAuthenticate(server, tokenManager);
  registerGetReport(server, client);
  registerCreateReport(server, client);
  registerUpdateReport(server, client);
  registerListRealisateurs(server, client);

  return server;
}
