import type { TokenManager } from "./auth/tokenManager.js";

export interface RealisateurRefDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PlanningEventDTO {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  ticketId: string;
  project: { key: string; name: string };
  realisateur: RealisateurRefDTO;
}

export class PlanningApiClient {
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

  async searchEvents(params: { from?: string; to?: string; projectKey?: string }): Promise<PlanningEventDTO[]> {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.projectKey) qs.set("projectKey", params.projectKey);

    const res = await this.request(`/planning?${qs.toString()}`);
    if (!res.ok) throw new Error(`Recherche de planning échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<PlanningEventDTO[]>;
  }

  async getDay(date: string): Promise<PlanningEventDTO[]> {
    const qs = new URLSearchParams({ date });
    const res = await this.request(`/planning?${qs.toString()}`);
    if (!res.ok) throw new Error(`Lecture du planning échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<PlanningEventDTO[]>;
  }

  async getEvent(id: string): Promise<PlanningEventDTO | null> {
    const res = await this.request(`/planning/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lecture de l'événement échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<PlanningEventDTO>;
  }

  async createEvent(input: {
    ticketId: string;
    realisateurId: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    type?: string;
  }): Promise<PlanningEventDTO> {
    const res = await this.request(`/planning`, { method: "POST", body: JSON.stringify(input) });
    if (!res.ok) throw new Error(`Création de l'événement échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<PlanningEventDTO>;
  }

  async updateEvent(
    id: string,
    input: { date?: string; startTime?: string; endTime?: string; type?: string }
  ): Promise<PlanningEventDTO | null> {
    const res = await this.request(`/planning/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Mise à jour de l'événement échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<PlanningEventDTO>;
  }

  async listRealisateurs(): Promise<RealisateurRefDTO[]> {
    const res = await this.request(`/realisateurs`);
    if (!res.ok) throw new Error(`Lecture des réalisateurs échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<RealisateurRefDTO[]>;
  }
}
