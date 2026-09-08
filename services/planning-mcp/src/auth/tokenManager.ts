interface TokenState {
  token: string;
  expiresAt: number;
}

export class NotAuthenticatedError extends Error {
  constructor(message = "Non authentifié : appelle d'abord le tool 'authenticate' avec un token portail valide.") {
    super(message);
  }
}

const DEFAULT_PORTAL_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

// Même principe que Ticket MCP : le MCP ne détient aucun credential par
// défaut, Claude doit fournir le token portail via le tool `authenticate`
// (le même token que pour Ticket MCP et Report MCP — une seule identité
// utilisateur). Échangé contre un Planning Service Token (session propre
// à Planning API), mis en cache et renouvelé automatiquement.
//
// Il n'y a pas de vrai service Portal dans ce POC : la validité du token
// portail (par défaut 4h) est donc imposée côté MCP lui-même, à partir
// du moment où `authenticate` a été appelé — pas par une expiration
// intégrée au token.
export class TokenManager {
  private portalToken: string | null = null;
  private portalTokenExpiresAt: number | null = null;
  private state: TokenState | null = null;
  private inFlight: Promise<TokenState> | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly portalTokenTtlMs: number = DEFAULT_PORTAL_TOKEN_TTL_MS
  ) {}

  isAuthenticated(): boolean {
    return this.hasValidPortalToken();
  }

  async authenticate(portalToken: string): Promise<TokenState & { portalTokenExpiresAt: number }> {
    this.portalToken = portalToken;
    this.portalTokenExpiresAt = Date.now() + this.portalTokenTtlMs;
    this.state = null;
    const state = await this.refresh();
    return { ...state, portalTokenExpiresAt: this.portalTokenExpiresAt };
  }

  async getToken(forceRefresh = false): Promise<string> {
    this.assertPortalTokenValid();

    if (!forceRefresh && this.state && this.state.expiresAt - Date.now() > 5_000) {
      return this.state.token;
    }
    const state = await this.refresh();
    return state.token;
  }

  private assertPortalTokenValid() {
    if (!this.portalToken) throw new NotAuthenticatedError();
    if (this.portalTokenExpiresAt !== null && Date.now() > this.portalTokenExpiresAt) {
      this.portalToken = null;
      this.portalTokenExpiresAt = null;
      throw new NotAuthenticatedError(
        "Token portail expiré (validité 4h) : appelle 'authenticate' avec un token portail valide."
      );
    }
  }

  private hasValidPortalToken(): boolean {
    try {
      this.assertPortalTokenValid();
      return true;
    } catch {
      return false;
    }
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
    this.assertPortalTokenValid();

    const res = await fetch(`${this.apiBaseUrl}/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ portalToken: this.portalToken }),
    });

    if (res.status === 403) {
      this.portalToken = null;
      this.portalTokenExpiresAt = null;
      throw new Error("Token portail refusé par Planning API. Appelle 'authenticate' avec un token valide.");
    }
    if (!res.ok) {
      throw new Error(`Échange de token échoué (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as TokenState;
    this.state = data;
    return data;
  }
}
