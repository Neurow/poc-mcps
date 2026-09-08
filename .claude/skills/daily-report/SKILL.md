---
name: daily-report
description: Génère la synthèse quotidienne d'activité à partir du planning de la veille et des tickets associés, regroupée par projet, puis crée ou met à jour le rapport correspondant après validation explicite de l'utilisateur. Utiliser quand l'utilisateur demande "le rapport du jour", "la synthèse d'hier", "génère mon daily report" ou équivalent.
---

# Daily report

Ce Skill orchestre trois serveurs MCP indépendants (`ticket`, `planning`, `report`) pour produire et
enregistrer une synthèse quotidienne. Il ne doit jamais appeler d'API métier directement : toutes les
lectures et écritures passent par les tools MCP correspondants. C'est cette orchestration multi-MCP —
et non le contenu du rapport lui-même — qui est la démonstration de valeur du POC.

Rappel des responsabilités : ce Skill porte le workflow et les règles métier ; c'est à lui, et non aux
MCP, de décider quand demander une confirmation à l'utilisateur avant une écriture.

## Étapes

### 0. S'authentifier sur chaque MCP nécessaire

Chaque MCP exige une authentification explicite avant tout autre tool : appelle `mcp__planning__authenticate`,
`mcp__ticket__authenticate` et `mcp__report__authenticate` (au moment où tu en as besoin dans le
workflow, pas nécessairement tous d'un coup) avec le token du domaine correspondant. Si tu ne connais
pas ces tokens, demande-les à l'utilisateur plutôt que d'en inventer un — ne saute jamais cette étape
silencieusement. Si un tool métier échoue avec une erreur d'authentification en cours de route (token
expiré ou jamais fourni), ré-appelle `authenticate` sur le MCP concerné avant de continuer.

### 1. Déterminer la date cible

Par défaut, la date cible est **la veille** de la date du jour (calculée par toi, au format
`YYYY-MM-DD`). Si l'utilisateur précise une autre date, utilise celle-ci à la place.

### 2. Récupérer le planning de la date cible

Appelle `mcp__planning__get_planning_day` avec cette date. Le résultat est une liste d'événements,
chacun avec `project.key`, `title`, `startTime`/`endTime`, `type` (`work` ou `meeting`), et
éventuellement `ticketId`.

S'il n'y a aucun événement, informe l'utilisateur qu'il n'y a rien à synthétiser pour cette date et
arrête-toi là (ne crée pas de rapport vide).

### 3. Regrouper par projet

Regroupe les événements par `project.key`. Pour chaque projet représenté :

- calcule le temps total passé en `work` et en `meeting` (à partir de `startTime`/`endTime`) ;
- liste les titres des événements (ce sont les seules descriptions dont tu disposes du travail
  effectué ce jour-là).

### 4. Enrichir avec les tickets actifs de chaque projet

Pour chaque projet identifié à l'étape 3, appelle `mcp__ticket__search_tickets` avec
`projectKey` et `status: "in_progress"`, puis à nouveau avec `status: "open"`. Garde au maximum les
5 tickets les plus pertinents par projet (les plus récents `updatedAt`/`createdAt` en priorité) —
inutile de tout lister, l'objectif est de donner du contexte, pas un export complet.

Règle métier : un ticket `closed` ne doit pas apparaître dans le rapport, même s'il est référencé par
un `ticketId` dans un événement de planning — le rapport reflète le travail en cours, pas l'historique
clos.

### 5. Composer la synthèse

Rédige un contenu markdown avec une section par projet (titre = nom du projet), contenant :

- un résumé du temps passé (ex: "3h de travail, 1h30 de réunion") ;
- les événements de la journée, en une ligne chacun ;
- une sous-liste "Tickets actifs" avec les tickets trouvés à l'étape 4 (id court + titre + statut).

Commence le document par un titre de premier niveau avec la date (ex: `# Synthèse du 2026-09-07`).

### 6. Présenter et valider avant écriture

Affiche cette synthèse à l'utilisateur dans ta réponse (pas seulement en résumé — le contenu complet
que tu proposes d'enregistrer) et demande explicitement une confirmation avant d'appeler un tool
d'écriture. N'appelle **jamais** `create_report` ou `update_report` sans confirmation explicite, même
si l'utilisateur a validé une étape précédente du workflow — la validation porte spécifiquement sur
l'écriture.

### 7. Enregistrer le rapport

Une fois la confirmation obtenue :

1. Appelle `mcp__report__get_report` avec la date cible.
2. S'il n'existe pas (l'outil renvoie une erreur "aucun rapport trouvé"), appelle
   `mcp__report__create_report` avec `date`, `content`, et `status: "draft"`.
3. S'il existe déjà, informe l'utilisateur qu'un rapport existe pour cette date et demande s'il veut
   l'écraser ; si oui, appelle `mcp__report__update_report` avec son `id` et le nouveau `content`.

Confirme à l'utilisateur que le rapport a été enregistré, avec son `id` et son `status`.
