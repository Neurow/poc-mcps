import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const API_TOKEN = process.env.API_TOKEN;
const TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 60);

if (!API_TOKEN) {
  throw new Error("API_TOKEN env var is required");
}

interface ServiceTokenEntry {
  expiresAt: number;
}

// Même principe que Ticket API : cache en mémoire des Planning Service
// Tokens émis, TTL court pour rendre l'expiration/renouvellement
// observables. Système indépendant -> implémentation dupliquée, pas
// partagée avec Ticket API.
const serviceTokens = new Map<string, ServiceTokenEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of serviceTokens) {
    if (entry.expiresAt < now) serviceTokens.delete(token);
  }
}, 5 * 60 * 1000).unref();

export function exchangeToken(apiToken: string): { token: string; expiresAt: number } | null {
  if (apiToken !== API_TOKEN) return null;

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
