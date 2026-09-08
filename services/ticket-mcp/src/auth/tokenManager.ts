interface TokenState {
  token: string;
  expiresAt: number;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Non authentifié : appelle d'abord le tool 'authenticate' avec un token Ticket API valide.");
  }
}

// Le MCP ne détient aucun credential par défaut : c'est Claude qui doit
// fournir le token Ticket API via le tool `authenticate` (obtenu par
// l'utilisateur auprès du système Ticket, comme pour une vraie clé
// d'API). Ce token est ensuite échangé contre un Ticket Service Token
// à durée de vie courte, mis en cache ici, et réutilisé/renouvelé
// automatiquement tant que le token d'origine reste valide.
export class TokenManager {
  private apiToken: string | null = null;
  private state: TokenState | null = null;
  private inFlight: Promise<TokenState> | null = null;

  constructor(private readonly apiBaseUrl: string) {}

  isAuthenticated(): boolean {
    return this.apiToken !== null;
  }

  async authenticate(apiToken: string): Promise<TokenState> {
    this.apiToken = apiToken;
    this.state = null;
    return this.refresh();
  }

  async getToken(forceRefresh = false): Promise<string> {
    if (!this.apiToken) throw new NotAuthenticatedError();

    if (!forceRefresh && this.state && this.state.expiresAt - Date.now() > 5_000) {
      return this.state.token;
    }
    const state = await this.refresh();
    return state.token;
  }

  private refresh(): Promise<TokenState> {
    if (!this.inFlight) {
      this.inFlight = this.exchange().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async exchange(): Promise<TokenState> {
    if (!this.apiToken) throw new NotAuthenticatedError();

    const res = await fetch(`${this.apiBaseUrl}/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiToken: this.apiToken }),
    });

    if (res.status === 403) {
      // Token refusé par l'API : on l'oublie pour forcer une nouvelle
      // authentification explicite plutôt que de boucler dessus.
      this.apiToken = null;
      throw new Error("Token Ticket API refusé par l'API. Appelle 'authenticate' avec un token valide.");
    }
    if (!res.ok) {
      throw new Error(`Échange de token échoué (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as TokenState;
    this.state = data;
    return data;
  }
}
