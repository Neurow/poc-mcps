import type { TokenManager } from "./auth/tokenManager.js";

export interface ReportEntryInput {
  ticketId: string;
  startTime: string;
  endTime: string;
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

  async getReport(date: string): Promise<ReportDTO | null> {
    const res = await this.request(`/reports/${encodeURIComponent(date)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lecture du rapport échouée (${res.status}): ${await res.text()}`);
    return res.json() as Promise<ReportDTO>;
  }

  async createReport(input: {
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
}
