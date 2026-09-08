import type { TokenManager } from "./auth/tokenManager.js";

export interface RealisateurRefDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TicketDTO {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee: RealisateurRefDTO | null;
  estimatedMinutes: number | null;
  timeSpentMinutes: number;
  project: { key: string; name: string };
  createdAt: string;
  updatedAt: string;
  comments?: { id: string; author: RealisateurRefDTO; body: string; createdAt: string }[];
}

// Adapte l'API Ticket (technique, orientée CRUD) vers des méthodes
// prêtes à être exposées comme tools MCP : gère l'authentification
// (attache le token, rafraîchit et retry une fois sur 401) et laisse
// la normalisation des réponses aux tools.
export class TicketApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenManager: TokenManager
  ) {}

  private async request(path: string, init: RequestInit = {}, retryOn401 = true): Promise<Response> {
    const token = await this.tokenManager.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401 && retryOn401) {
      await this.tokenManager.getToken(true);
      return this.request(path, init, false);
    }

    return res;
  }

  async searchTickets(params: { query?: string; status?: string; projectKey?: string }): Promise<TicketDTO[]> {
    const qs = new URLSearchParams();
    if (params.query) qs.set("q", params.query);
    if (params.status) qs.set("status", params.status);
    if (params.projectKey) qs.set("projectKey", params.projectKey);

    const res = await this.request(`/tickets?${qs.toString()}`);
    if (!res.ok) throw new Error(`Recherche de tickets échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<TicketDTO[]>;
  }

  async getTicket(id: string): Promise<TicketDTO | null> {
    const res = await this.request(`/tickets/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lecture du ticket échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<TicketDTO>;
  }

  async createTicket(input: {
    projectKey: string;
    title: string;
    description?: string;
    assigneeId?: string;
    estimatedMinutes?: number;
  }): Promise<TicketDTO> {
    const res = await this.request(`/tickets`, { method: "POST", body: JSON.stringify(input) });
    if (!res.ok) throw new Error(`Création du ticket échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<TicketDTO>;
  }

  async updateTicket(
    id: string,
    input: {
      title?: string;
      description?: string;
      status?: string;
      assigneeId?: string | null;
      estimatedMinutes?: number | null;
    }
  ): Promise<TicketDTO | null> {
    const res = await this.request(`/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Mise à jour du ticket échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<TicketDTO>;
  }

  async addComment(id: string, input: { authorId: string; body: string }): Promise<TicketDTO | null> {
    const res = await this.request(`/tickets/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Ajout du commentaire échoué (${res.status}): ${await res.text()}`);
    return res.json() as Promise<TicketDTO>;
  }

  async listRealisateurs(): Promise<RealisateurRefDTO[]> {
    const res = await this.request(`/realisateurs`);
    if (!res.ok) throw new Error(`Lecture des réalisateurs échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<RealisateurRefDTO[]>;
  }
}
