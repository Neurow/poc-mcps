import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenManager } from "./auth/tokenManager.js";
import type { TicketApiClient } from "./ticketApiClient.js";
import { registerAuthenticate } from "./tools/authenticate.js";
import { registerSearchTickets } from "./tools/searchTickets.js";
import { registerGetTicket } from "./tools/getTicket.js";
import { registerCreateTicket } from "./tools/createTicket.js";
import { registerUpdateTicket } from "./tools/updateTicket.js";
import { registerAddComment } from "./tools/addComment.js";
import { registerListRealisateurs } from "./tools/listRealisateurs.js";

export function createTicketMcpServer(client: TicketApiClient, tokenManager: TokenManager): McpServer {
  const server = new McpServer({ name: "ticket-mcp", version: "0.1.0" });

  registerAuthenticate(server, tokenManager);
  registerSearchTickets(server, client);
  registerGetTicket(server, client);
  registerCreateTicket(server, client);
  registerUpdateTicket(server, client);
  registerAddComment(server, client);
  registerListRealisateurs(server, client);

  return server;
}
