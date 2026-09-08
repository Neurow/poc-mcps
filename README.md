# poc-mcps

POC : plusieurs serveurs MCP indépendants exposant des API métier existantes à un agent IA (Claude), sans gateway d'agrégation.

## Principe

```
Claude
  ├── Ticket MCP    → Ticket API    ─┐
  ├── Planning MCP  → Planning API  ─┼─→ PostgreSQL
  └── Report MCP    → Report API    ─┘
```

Chaque MCP est un service Docker indépendant avec son propre endpoint HTTP (Streamable HTTP, SDK MCP officiel). Claude est configuré avec trois serveurs MCP distincts (`.mcp.json`) — aucun agrégateur ne fusionne leurs tools. Un Skill (`poc-daily-report`) orchestre les trois pour un workflow métier complet.

## Démarrage

```bash
docker compose up --build
```

Services exposés sur l'hôte (uniquement les MCP — les API et Postgres restent internes au réseau Docker) :

| Service | URL | Tools |
|---|---|---|
| Ticket MCP | `http://localhost:3101/mcp` | `authenticate`, `search_tickets`, `get_ticket`, `create_ticket`, `update_ticket`, `add_comment` |
| Planning MCP | `http://localhost:3102/mcp` | `authenticate`, `get_planning_day`, `search_planning`, `get_planning_event` |
| Report MCP | `http://localhost:3103/mcp` | `authenticate`, `get_report`, `create_report`, `update_report` |

Chaque MCP nécessite une authentification explicite avant tout autre tool (voir section suivante) : appeler `authenticate` avec le token du domaine concerné.

Au premier démarrage, chaque API applique son schéma Prisma (`prisma db push`) et génère des données fictives via Faker (seed idempotent — ignoré si des données existent déjà) :

- **Ticket** : 3 projets (`WEB`, `MOBILE`, `API`), ~8 tickets chacun, quelques commentaires
- **Planning** : événements sur les 10 derniers jours pour les 3 mêmes projets (la veille est garantie non-vide, pour la démo du Skill)
- **Report** : quelques rapports sur les jours 5 à 9 (les 4 derniers jours restent libres pour la démo)

Claude Code est configuré via [.mcp.json](.mcp.json) pour se connecter aux trois serveurs. Le fichier ayant été créé/modifié en session, un redémarrage de session Claude Code est nécessaire pour (re)charger la configuration à chaque ajout de serveur.

## Visualiser les données

Pas d'interface custom : [Prisma Studio](https://www.prisma.io/studio) suffit largement pour "juste visualiser" — un service par domaine, réutilisant l'image `*-api` existante (juste une commande différente), en opt-in via un profil Compose pour ne pas alourdir le `docker compose up` de base :

```bash
docker compose --profile tools up -d ticket-studio planning-studio report-studio
```

| Studio | URL |
|---|---|
| Ticket | `http://localhost:5601` |
| Planning | `http://localhost:5602` |
| Report | `http://localhost:5603` |

## Authentification (simulée)

Le principe : chaque API métier est un système pré-existant qui exige déjà son propre token d'accès (comme une vraie clé d'API), au même titre que la logique métier — l'auth est portée par l'API, pas inventée par le MCP. Le MCP, lui, ne détient **aucun credential par défaut** : il expose l'authentification comme un tool explicite (`authenticate`) que l'agent doit appeler, avec un token que l'utilisateur fournit (obtenu "auprès du système", ici simplement documenté ci-dessous — il n'y a qu'un seul utilisateur fictif).

Tokens de démo (définis en dur dans `docker-compose.yml`, un par domaine — ce sont des systèmes indépendants, pas de SSO partagé) :

| Domaine | Token |
|---|---|
| Ticket | `demo-ticket-api-token-9f8a` |
| Planning | `demo-planning-api-token-3c2d` |
| Report | `demo-report-api-token-7e1b` |

Flux :

1. Claude appelle `authenticate({ token })` sur le MCP concerné, avec le token ci-dessus.
2. Le MCP échange ce token auprès de son API via `POST /auth/exchange`, obtient un **service token** à durée de vie courte (60s par défaut, `AUTH_TOKEN_TTL_SECONDS`), et le met en cache en mémoire.
3. Les tools métier suivants attachent ce service token en `Authorization: Bearer ...`. Sur un `401` (expiration), le MCP ré-échange automatiquement avec le token d'origine (toujours en mémoire) et rejoue la requête une fois — sans que Claude ait besoin de ré-authentifier à chaque appel.
4. Si le token fourni à `authenticate` est invalide, l'API le refuse (`403`) et le MCP l'oublie : Claude doit ré-appeler `authenticate` avec un token valide. Tant qu'aucune authentification n'a eu lieu, tout tool métier renvoie une erreur explicite invitant à appeler `authenticate` d'abord.

Cette authentification vit au niveau du process MCP (partagée entre sessions, cohérent avec l'hypothèse d'un seul utilisateur fictif), pas au niveau de chaque appel d'outil individuel. L'implémentation (TokenManager + endpoint `/auth/exchange`) est dupliquée à l'identique dans chaque MCP/API plutôt que partagée : ce sont des systèmes indépendants qui ne partagent pas de code runtime.

## Le Skill `poc-daily-report`

Convention : tous les Skills de ce repo sont préfixés `poc-`.

[.claude/skills/poc-daily-report/SKILL.md](.claude/skills/poc-daily-report/SKILL.md) orchestre les trois MCP pour produire une synthèse quotidienne :

```
Skill
  ↓
Claude
  ├── Planning MCP (get_planning_day) → planning de la veille
  ├── Ticket MCP (search_tickets)     → tickets actifs par projet
  ├── raisonnement : regroupement par projet, règles métier
  └── après validation utilisateur explicite
         ↓
      Report MCP (create_report / update_report)
```

Le Skill ne connaît que les tools MCP, jamais les API. La confirmation utilisateur avant écriture est portée par le Skill (le workflow), pas par le MCP (qui reste mécanique).

Déclenchement : demander à Claude "génère mon daily report" / "la synthèse d'hier", ou invoquer `/poc-daily-report`.

## Où se trouve quoi

| Couche | Répertoire | Rôle |
|---|---|---|
| Ticket API | [services/ticket-api](services/ticket-api) | Système métier, CRUD tickets/commentaires |
| Ticket MCP | [services/ticket-mcp](services/ticket-mcp) | Interface agent pour Ticket API |
| Planning API | [services/planning-api](services/planning-api) | Système métier, lecture d'événements de planning |
| Planning MCP | [services/planning-mcp](services/planning-mcp) | Interface agent pour Planning API |
| Report API | [services/report-api](services/report-api) | Système métier, CRUD rapports quotidiens |
| Report MCP | [services/report-mcp](services/report-mcp) | Interface agent pour Report API |
| PostgreSQL | `postgres` (compose) | Persistance, une base par domaine (`ticket`, `planning`, `report`) |
| Skill | [.claude/skills/poc-daily-report](.claude/skills/poc-daily-report) | Workflow métier orchestrant les trois MCP |

Chaque `*-api` : Express + Prisma + CRUD + auth par service token, aucune logique spécifique à Claude.
Chaque `*-mcp` : SDK MCP officiel, Streamable HTTP, tools Zod, gestion du token, normalisation des réponses API → agent.

## Étendre le POC

Pour ajouter un nouveau MCP (métier ou externe, ex: Google/Figma/GitHub) : créer le service, l'ajouter à `docker-compose.yml`, l'ajouter à `.mcp.json`. Aucun MCP existant n'a besoin d'être modifié — c'est le critère de réussite du POC.
