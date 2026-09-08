import type { TokenManager } from "./auth/tokenManager.js";

export interface RealisateurRefDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ReportEntryInput {
  ticketId: string;
  date: string;
  duration: number;
  description?: string;
}

export interface ReportEntryDTO extends ReportEntryInput {
  id: string;
}

export interface ReportDTO {
  id: string;
  date: string;
  content: string | null;
  status: string;
  realisateur: RealisateurRefDTO;
  entries: ReportEntryDTO[];
  createdAt: string;
  updatedAt: string;
}

export class ReportApiConflictError extends Error {
  constructor(public readonly existingId: string) {
    super(`Un rapport existe déjà pour cette date (id: ${existingId})`);
  }
}

export class ReportApiClient {
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

  async getReport(realisateurId: string, date: string): Promise<ReportDTO | null> {
    const res = await this.request(`/reports/${encodeURIComponent(realisateurId)}/${encodeURIComponent(date)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lecture du rapport échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<ReportDTO>;
  }

  async createReport(input: {
    realisateurId: string;
    date: string;
    content?: string;
    status?: string;
    entries?: ReportEntryInput[];
  }): Promise<ReportDTO> {
    const res = await this.request(`/reports`, { method: "POST", body: JSON.stringify(input) });
    if (res.status === 409) {
      const body = (await res.json()) as { id: string };
      throw new ReportApiConflictError(body.id);
    }
    if (!res.ok) throw new Error(`Création du rapport échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<ReportDTO>;
  }

  async updateReport(
    id: string,
    input: { content?: string; status?: string; entries?: ReportEntryInput[] }
  ): Promise<ReportDTO | null> {
    const res = await this.request(`/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Mise à jour du rapport échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<ReportDTO>;
  }

  async listRealisateurs(): Promise<RealisateurRefDTO[]> {
    const res = await this.request(`/realisateurs`);
    if (!res.ok) throw new Error(`Lecture des réalisateurs échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<RealisateurRefDTO[]>;
  }
}
