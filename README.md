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

Un rapport (`Report`) n'est pas qu'un texte libre : `create_report`/`update_report` acceptent une liste `entries` — une entrée par ticket, `{ ticketId, date, duration, description? }` (`date` = horodatage ISO précis du début de la tâche, `duration` en minutes) — de quoi reconstruire entièrement ce qu'une personne a fait sur une journée. `content` reste un résumé markdown optionnel en complément. `update_report` remplace entièrement les `entries` existantes quand on en fournit de nouvelles (pas de fusion partielle).

Au premier démarrage, `ticket-api` et `planning-api` appliquent leur schéma Prisma (`prisma db push`) et génèrent des données fictives (seed idempotent — ignoré si des données existent déjà) :

- **Ticket** : 2 projets (`NOVA`, une app desktop & mobile de suivi de budget ; `API`, la plateforme API interne), une dizaine de tickets réalistes en français, quelques commentaires
- **Planning** : événements sur les 10 derniers jours pour les 2 mêmes projets (la veille est garantie non-vide, pour la démo du Skill). **Seed partagé avec Ticket** : au démarrage, `planning-api` s'authentifie auprès de `ticket-api` (même `PORTAL_TOKEN`) et lit les vrais tickets pour que les `ticketId` des événements générés référencent de vrais tickets — pas des identifiants aléatoires. `planning-api` attend que `ticket-api` réponde avant de seeder (retry avec backoff), et comme `ticket-api` ne démarre son serveur HTTP qu'une fois son propre seed terminé, les données lues sont toujours complètes.
- **Report** : pas de seed — la table démarre vide, c'est au Skill (ou à toi manuellement) de créer des rapports.

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

Principe façon OAuth2 : un **Portal** (simulé — pas un service à part, juste un token statique documenté ci-dessous) délivre **un seul token portail** représentant l'unique utilisateur fictif du POC. Ce même token est ensuite présenté séparément à chacune des trois API (Ticket, Planning, Report) ; chacune le valide indépendamment et, si valide, ouvre sa **propre session** (Service Token) — exactement comme un mécanisme OAuth2 "échange un token d'identité contre un token de session par ressource". Le MCP ne détient **aucun credential par défaut** : c'est un tool explicite (`authenticate`) que l'agent doit appeler avec ce token portail, jamais injecté automatiquement.

Token de démo (défini en dur dans `docker-compose.yml`, **identique pour les trois `*-api`**) :

```
demo-portal-token-83f1c2
```

Raccourcis de test, acceptés par les trois API en plus du vrai token (pratique pour tester les deux
chemins depuis un Skill sans connaître ni altérer le vrai token) :

| Token fourni | Résultat |
|---|---|
| `"true"` | Toujours accepté (équivalent à un token portail valide) |
| `"false"` | Toujours refusé (`403`, équivalent à un token portail invalide) |
| le vrai token | Comportement normal |

Flux, à répéter une fois par MCP (le token fourni est le même à chaque fois) :

1. Claude appelle `authenticate({ token })` sur le MCP concerné, avec le token portail ci-dessus.
2. Ce MCP échange ce token auprès de **son** API via `POST /auth/exchange`, obtient une **session** (service token) à durée de vie de **1h** (`AUTH_TOKEN_TTL_SECONDS=3600`, côté API), propre à ce domaine, et la met en cache en mémoire.
3. Les tools métier suivants attachent cette session en `Authorization: Bearer ...`. Sur un `401` (expiration), le MCP ré-échange automatiquement avec le token portail (toujours en mémoire) et rejoue la requête une fois — sans que Claude ait besoin de ré-authentifier à chaque appel.
4. Si le token portail est invalide, l'API le refuse (`403`) et le MCP l'oublie : Claude doit ré-appeler `authenticate` avec un token valide. Tant qu'aucune authentification n'a eu lieu sur un MCP donné, tout tool métier de ce MCP renvoie une erreur explicite invitant à appeler `authenticate` d'abord.
5. Le token portail lui-même est considéré valide **4h** (`PORTAL_TOKEN_TTL_SECONDS=14400`, côté MCP) à partir de l'appel à `authenticate` — il n'y a pas de vrai Portal qui l'expire réellement dans ce POC, c'est donc le MCP qui l'oublie de lui-même passé ce délai et exige un nouvel appel à `authenticate`, même si les 3600s de la session en cours n'ont pas encore expiré.

Au total, 4 tokens en circulation pour une session complète : 1 token portail (entrée, partagé, valide 4h) + 3 sessions dérivées (une par domaine, valides 1h chacune, jamais partagées entre elles — si la session Ticket expire, ça n'affecte pas Planning ni Report).

Cette authentification vit au niveau du process MCP (partagée entre sessions Claude, cohérent avec l'hypothèse d'un seul utilisateur fictif), pas au niveau de chaque appel d'outil individuel. L'implémentation (TokenManager + endpoint `/auth/exchange`) est dupliquée à l'identique dans chaque MCP/API plutôt que partagée : ce sont des systèmes indépendants qui ne partagent pas de code runtime — ils acceptent juste, dans ce POC, la même valeur de token portail.

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
