import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// Le Portal Token est le même pour les trois domaines (une seule identité
// utilisateur fictive, délivrée par un Portal simulé) : chaque API valide
// indépendamment ce même token et émet sa propre session (Service Token).
const PORTAL_TOKEN = process.env.PORTAL_TOKEN;
const TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60);

if (!PORTAL_TOKEN) {
  throw new Error("PORTAL_TOKEN env var is required");
}

interface ServiceTokenEntry {
  expiresAt: number;
}

// Cache en mémoire des Ticket Service Tokens émis. Volontairement non
// persisté : c'est un état d'authentification éphémère, pas une donnée
// métier. TTL court pour rendre l'expiration/renouvellement observables.
const serviceTokens = new Map<string, ServiceTokenEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of serviceTokens) {
    if (entry.expiresAt < now) serviceTokens.delete(token);
  }
}, 5 * 60 * 1000).unref();

// Raccourcis de démo/test : "true" force un succès, "false" force un
// refus, indépendamment du vrai PORTAL_TOKEN. Pratique pour tester les
// deux chemins (session ouverte / accès refusé) depuis un Skill sans
// avoir à connaître ni altérer le vrai token. Le vrai PORTAL_TOKEN reste
// évidemment accepté normalement.
export function exchangeToken(portalToken: string): { token: string; expiresAt: number } | null {
  if (portalToken === "false") return null;
  if (portalToken !== "true" && portalToken !== PORTAL_TOKEN) return null;

  const token = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + TTL_SECONDS * 1000;
  serviceTokens.set(token, { expiresAt });
  return { token, expiresAt };
}

export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const entry = token ? serviceTokens.get(token) : undefined;

  if (!token || !entry) {
    res.status(401).json({ error: "invalid_or_expired_token" });
    return;
  }

  if (entry.expiresAt < Date.now()) {
    serviceTokens.delete(token);
    res.status(401).json({ error: "invalid_or_expired_token" });
    return;
  }

  next();
}
