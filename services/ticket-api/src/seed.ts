import { prisma } from "./db.js";

// Réalisateurs et projets sont des entités transverses (partagées entre
// Ticket/Planning/Report via la base unique `poc`), sans propriétaire de
// domaine évident — c'est ticket-api qui seed cette donnée de référence
// car c'est déjà lui le propriétaire du schéma (voir docker-compose.yml).
const REALISATEUR_DEFS = [
  { firstName: "Benjamin", lastName: "Girard" },
  { firstName: "Arnaud", lastName: "Lefevre" },
  { firstName: "Tom", lastName: "Rousseau" },
];

// Une seule application "POC", trois projets par surface technique.
const PROJECT_DEFS = [
  { key: "BACK", name: "POC — Back-end" },
  { key: "WEB", name: "POC — Web" },
  { key: "MOBILE", name: "POC — Mobile" },
];

type Status = "open" | "in_progress" | "closed";

interface TicketDef {
  key: string;
  projectKey: string;
  title: string;
  description: string;
  status: Status;
  assigneeFirstName: string | null;
  estimatedMinutes: number | null;
}

// 30 tickets (10 par projet), volontairement pas tous dans le même état :
// des tickets fermés (temps théorique dépassé ou non, dans les deux sens),
// des tickets en cours (avec ou sans suite planifiée), des tickets encore
// non démarrés mais déjà planifiés, et un vrai backlog (non assigné, pas
// de temps théorique, rien de planifié) — pour que les requêtes "où en est
// le projet", "qui a travaillé sur quoi récemment" et "quels tickets ont
// dépassé le théorique" aient toutes une réponse riche, sans tout remplir.
const TICKET_DEFS: TicketDef[] = [
  // --- BACK ---
  {
    key: "B1",
    projectKey: "BACK",
    title: "Définition des contrats d'API du POC",
    description:
      "Cadrer et documenter les contrats d'API (endpoints, formats d'échange) entre le back-end, " +
      "le web et le mobile avant le début des développements.",
    status: "closed",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 480,
  },
  {
    key: "B2",
    projectKey: "BACK",
    title: "Implémenter l'authentification (Back-end)",
    description: "Mettre en place l'authentification (échange de token, sessions) côté API back-end.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 240,
  },
  {
    key: "B3",
    projectKey: "BACK",
    title: "Valider les payloads entrants avec Zod sur tous les endpoints",
    description:
      "Ajouter une validation stricte (Zod) sur le corps des requêtes de tous les endpoints d'écriture, " +
      "pour renvoyer des erreurs 400 explicites plutôt que des exceptions non gérées.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 180,
  },
  {
    key: "B4",
    projectKey: "BACK",
    title: "Ajouter la pagination sur la recherche de tickets",
    description:
      "L'endpoint de recherche de tickets renvoie tout en une fois (limité à 50) : ajouter un vrai " +
      "système de pagination pour les projets avec beaucoup de tickets.",
    status: "in_progress",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 120,
  },
  {
    key: "B5",
    projectKey: "BACK",
    title: "Corriger une fuite de connexions Postgres sous forte charge",
    description:
      "Sous forte charge, le pool de connexions Prisma se sature et les requêtes finissent en timeout. " +
      "Identifier la fuite et corriger la configuration du pool.",
    status: "closed",
    assigneeFirstName: "Tom",
    estimatedMinutes: 90,
  },
  {
    key: "B6",
    projectKey: "BACK",
    title: "Ajouter un rate limiting sur les endpoints d'authentification",
    description: "Nécessaire pour se prémunir contre les attaques par force brute sur /auth/exchange.",
    status: "open",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 150,
  },
  {
    key: "B7",
    projectKey: "BACK",
    title: "Écrire les tests d'intégration du module de rapports",
    description:
      "Couvrir la création, la mise à jour et le remplacement des entries d'un rapport par des tests " +
      "d'intégration automatisés.",
    status: "open",
    assigneeFirstName: null,
    estimatedMinutes: null,
  },
  {
    key: "B8",
    projectKey: "BACK",
    title: "Mettre en place un cache Redis pour les endpoints les plus sollicités",
    description:
      "Les endpoints de recherche de tickets et de planning sont appelés très fréquemment par les MCP : " +
      "ajouter un cache Redis pour réduire la charge sur Postgres.",
    status: "in_progress",
    assigneeFirstName: "Tom",
    estimatedMinutes: 300,
  },
  {
    key: "B9",
    projectKey: "BACK",
    title: "Restreindre les endpoints d'administration par rôle",
    description:
      "Certains endpoints (ex: suppression de projet) ne devraient être accessibles qu'à un rôle admin — " +
      "ajouter un contrôle de rôle basique.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 120,
  },
  {
    key: "B10",
    projectKey: "BACK",
    title: "Migrer les logs applicatifs vers un format structuré (JSON)",
    description:
      "Remplacer les logs texte par des logs JSON structurés sur les trois API, pour faciliter leur " +
      "exploitation dans un outil d'agrégation de logs.",
    status: "closed",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 180,
  },

  // --- WEB ---
  {
    key: "W1",
    projectKey: "WEB",
    title: "Implémenter l'authentification (Web)",
    description: "Intégrer l'authentification côté application web (formulaire de connexion, gestion de session).",
    status: "closed",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 240,
  },
  {
    key: "W2",
    projectKey: "WEB",
    title: "Créer le tableau de bord de suivi des tickets par projet",
    description:
      "Vue d'ensemble avec répartition des tickets par statut et par projet, temps théorique vs temps " +
      "passé, pour donner une vision rapide de l'avancement.",
    status: "closed",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 360,
  },
  {
    key: "W3",
    projectKey: "WEB",
    title: "Intégrer la recherche de tickets avec filtres avancés",
    description: "Ajouter des filtres combinables (projet, statut, réalisateur assigné) sur la page de recherche.",
    status: "in_progress",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 180,
  },
  {
    key: "W4",
    projectKey: "WEB",
    title: "Ajouter le mode sombre à l'interface",
    description: "Proposer un thème sombre, avec bascule automatique selon les préférences système.",
    status: "open",
    assigneeFirstName: "Tom",
    estimatedMinutes: 60,
  },
  {
    key: "W5",
    projectKey: "WEB",
    title: "Corriger l'affichage du planning sur petits écrans",
    description:
      "La vue planning déborde horizontalement sur les écrans de moins de 768px, rendant certains " +
      "créneaux illisibles.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 90,
  },
  {
    key: "W6",
    projectKey: "WEB",
    title: "Ajouter l'export CSV des rapports",
    description:
      "Permettre l'export d'un rapport (et ses entries) au format CSV depuis l'interface web, pour " +
      "import dans un tableur externe.",
    status: "open",
    assigneeFirstName: null,
    estimatedMinutes: null,
  },
  {
    key: "W7",
    projectKey: "WEB",
    title: "Refondre la page de connexion (nouvelle charte graphique)",
    description: "Mettre à jour visuellement la page de connexion pour suivre la nouvelle charte graphique validée.",
    status: "in_progress",
    assigneeFirstName: "Tom",
    estimatedMinutes: 150,
  },
  {
    key: "W8",
    projectKey: "WEB",
    title: "Ajouter des notifications temps réel (WebSocket) sur les tickets",
    description:
      "Notifier en direct les utilisateurs connectés lorsqu'un ticket qu'ils suivent change de statut " +
      "ou reçoit un commentaire.",
    status: "open",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 300,
  },
  {
    key: "W9",
    projectKey: "WEB",
    title: "Optimiser le temps de chargement initial du dashboard",
    description:
      "Le dashboard met plus de 4 secondes à afficher sa première donnée utile sur une connexion " +
      "moyenne — profiler et optimiser.",
    status: "closed",
    assigneeFirstName: "Tom",
    estimatedMinutes: 120,
  },
  {
    key: "W10",
    projectKey: "WEB",
    title: "Ajouter des commentaires enrichis (mentions, pièces jointes) sur les tickets",
    description: "Enrichir les commentaires de tickets avec la mention d'autres réalisateurs (@nom) et des pièces jointes.",
    status: "open",
    assigneeFirstName: null,
    estimatedMinutes: null,
  },

  // --- MOBILE ---
  {
    key: "M1",
    projectKey: "MOBILE",
    title: "Implémenter l'authentification (Mobile)",
    description:
      "Intégrer l'authentification côté application mobile (stockage sécurisé du token, écrans de connexion).",
    status: "closed",
    assigneeFirstName: "Tom",
    estimatedMinutes: 240,
  },
  {
    key: "M2",
    projectKey: "MOBILE",
    title: "Ajouter le mode hors-ligne avec synchronisation différée",
    description:
      "Permettre de consulter et pointer du temps sur les tickets déjà chargés sans réseau, avec " +
      "synchronisation automatique au retour de la connexion.",
    status: "in_progress",
    assigneeFirstName: "Tom",
    estimatedMinutes: 480,
  },
  {
    key: "M3",
    projectKey: "MOBILE",
    title: "Intégrer les notifications push",
    description: "Notifier l'utilisateur lorsqu'un ticket qui lui est assigné change de statut ou reçoit un commentaire.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 180,
  },
  {
    key: "M4",
    projectKey: "MOBILE",
    title: "Corriger le crash au démarrage sur Android 15",
    description:
      "L'application crashe systématiquement au lancement sur Android 15, à cause d'un changement de " +
      "comportement de l'API de notifications.",
    status: "closed",
    assigneeFirstName: "Tom",
    estimatedMinutes: 60,
  },
  {
    key: "M5",
    projectKey: "MOBILE",
    title: "Ajouter le scan de reçu par appareil photo",
    description: "Permettre de photographier un reçu et d'en extraire automatiquement le montant.",
    status: "open",
    assigneeFirstName: "Benjamin",
    estimatedMinutes: 240,
  },
  {
    key: "M6",
    projectKey: "MOBILE",
    title: "Optimiser la consommation batterie en arrière-plan",
    description:
      "L'application consomme trop de batterie lorsqu'elle est laissée ouverte en arrière-plan, à " +
      "cause d'un polling trop fréquent.",
    status: "in_progress",
    assigneeFirstName: "Tom",
    estimatedMinutes: 120,
  },
  {
    key: "M7",
    projectKey: "MOBILE",
    title: "Ajouter le support des raccourcis 3D Touch / appui long",
    description: "Proposer des actions rapides via appui long sur l'icône (nouveau ticket, dernier projet consulté).",
    status: "open",
    assigneeFirstName: null,
    estimatedMinutes: null,
  },
  {
    key: "M8",
    projectKey: "MOBILE",
    title: "Mettre à jour le SDK multiplateforme vers la dernière version",
    description: "Monter de version le SDK multiplateforme utilisé par l'application, et corriger les incompatibilités.",
    status: "closed",
    assigneeFirstName: "Arnaud",
    estimatedMinutes: 90,
  },
  {
    key: "M9",
    projectKey: "MOBILE",
    title: "Ajouter la biométrie (Face ID / empreinte) pour le déverrouillage rapide",
    description:
      "Permettre de déverrouiller l'application avec la biométrie du téléphone plutôt que de ressaisir " +
      "le token à chaque ouverture.",
    status: "in_progress",
    assigneeFirstName: "Tom",
    estimatedMinutes: 180,
  },
  {
    key: "M10",
    projectKey: "MOBILE",
    title: "Traduire l'application en anglais et espagnol",
    description: "Internationaliser les textes de l'application mobile et fournir les traductions anglaise et espagnole.",
    status: "open",
    assigneeFirstName: null,
    estimatedMinutes: 200,
  },
];

interface WorkSessionDef {
  ticketKey: string;
  realisateurFirstName: string;
  date: string; // YYYY-MM-DD, dans le passé — génère à la fois le rapport et le créneau de planning correspondant
  startTime: string; // HH:MM
  duration: number; // minutes
  description: string;
}

const WORK_SESSIONS: WorkSessionDef[] = [
  { ticketKey: "B1", realisateurFirstName: "Benjamin", date: "2026-08-18", startTime: "09:00", duration: 480, description: "Analyse et rédaction des contrats d'API" },
  { ticketKey: "B2", realisateurFirstName: "Arnaud", date: "2026-09-02", startTime: "09:00", duration: 180, description: "Implémentation de l'authentification back-end" },
  { ticketKey: "B3", realisateurFirstName: "Arnaud", date: "2026-09-03", startTime: "09:00", duration: 210, description: "Ajout de la validation Zod sur les endpoints tickets et rapports" },
  { ticketKey: "B4", realisateurFirstName: "Arnaud", date: "2026-09-08", startTime: "14:00", duration: 60, description: "Première passe sur la pagination côté API" },
  { ticketKey: "B5", realisateurFirstName: "Tom", date: "2026-09-05", startTime: "09:00", duration: 240, description: "Diagnostic et correction du pool de connexions Prisma" },
  { ticketKey: "B8", realisateurFirstName: "Tom", date: "2026-09-04", startTime: "09:00", duration: 90, description: "Mise en place de l'infrastructure Redis en local" },
  { ticketKey: "B9", realisateurFirstName: "Arnaud", date: "2026-09-06", startTime: "09:00", duration: 120, description: "Ajout du contrôle de rôle sur les routes d'administration" },
  { ticketKey: "B10", realisateurFirstName: "Benjamin", date: "2026-09-07", startTime: "09:00", duration: 90, description: "Mise en place du format de log JSON sur ticket-api" },
  { ticketKey: "B10", realisateurFirstName: "Tom", date: "2026-09-07", startTime: "14:00", duration: 90, description: "Migration des logs sur planning-api et report-api" },

  { ticketKey: "W1", realisateurFirstName: "Benjamin", date: "2026-09-04", startTime: "09:00", duration: 240, description: "Implémentation de l'authentification web" },
  { ticketKey: "W2", realisateurFirstName: "Benjamin", date: "2026-09-05", startTime: "09:00", duration: 420, description: "Développement du tableau de bord (graphiques + filtres)" },
  { ticketKey: "W3", realisateurFirstName: "Benjamin", date: "2026-09-08", startTime: "10:00", duration: 90, description: "Filtres par projet et statut en place, reste l'assigné" },
  { ticketKey: "W5", realisateurFirstName: "Arnaud", date: "2026-09-01", startTime: "09:00", duration: 60, description: "Correction du responsive sur la vue planning" },
  { ticketKey: "W7", realisateurFirstName: "Tom", date: "2026-09-07", startTime: "09:00", duration: 150, description: "Refonte visuelle complète de la page de connexion" },
  { ticketKey: "W9", realisateurFirstName: "Tom", date: "2026-09-06", startTime: "09:00", duration: 300, description: "Profilage et optimisation du bundle + lazy loading" },

  { ticketKey: "M1", realisateurFirstName: "Tom", date: "2026-09-03", startTime: "09:00", duration: 300, description: "Implémentation de l'authentification mobile" },
  { ticketKey: "M2", realisateurFirstName: "Tom", date: "2026-09-08", startTime: "09:00", duration: 180, description: "Mise en cache locale des tickets consultés hors-ligne" },
  { ticketKey: "M3", realisateurFirstName: "Arnaud", date: "2026-09-05", startTime: "09:00", duration: 180, description: "Intégration des notifications push (FCM/APNs)" },
  { ticketKey: "M4", realisateurFirstName: "Tom", date: "2026-09-09", startTime: "09:00", duration: 150, description: "Correction du crash lié à l'API de notifications Android 15" },
  { ticketKey: "M6", realisateurFirstName: "Tom", date: "2026-09-01", startTime: "14:00", duration: 45, description: "Analyse des sources de consommation batterie en arrière-plan" },
  { ticketKey: "M8", realisateurFirstName: "Arnaud", date: "2026-09-08", startTime: "09:00", duration: 90, description: "Montée de version du SDK multiplateforme et correctifs de compatibilité" },
  { ticketKey: "M9", realisateurFirstName: "Tom", date: "2026-09-09", startTime: "14:00", duration: 60, description: "Intégration biométrie côté Android" },
  { ticketKey: "M9", realisateurFirstName: "Benjamin", date: "2026-09-09", startTime: "09:00", duration: 60, description: "Intégration biométrie côté iOS" },
];

interface FuturePlanDef {
  ticketKey: string;
  realisateurFirstName: string;
  date: string; // YYYY-MM-DD, à venir — planifié mais pas encore réalisé, donc pas d'entry de rapport
  startTime: string;
  duration: number;
}

const FUTURE_PLANS: FuturePlanDef[] = [
  { ticketKey: "B4", realisateurFirstName: "Arnaud", date: "2026-09-11", startTime: "09:00", duration: 60 },
  { ticketKey: "B8", realisateurFirstName: "Tom", date: "2026-09-12", startTime: "09:00", duration: 180 },
  { ticketKey: "B6", realisateurFirstName: "Arnaud", date: "2026-09-15", startTime: "09:00", duration: 150 },
  { ticketKey: "W8", realisateurFirstName: "Arnaud", date: "2026-09-16", startTime: "09:00", duration: 300 },
  { ticketKey: "M2", realisateurFirstName: "Tom", date: "2026-09-14", startTime: "09:00", duration: 240 },
  { ticketKey: "M5", realisateurFirstName: "Benjamin", date: "2026-09-17", startTime: "09:00", duration: 240 },
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function main() {
  const existing = await prisma.realisateur.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} réalisateur(s) déjà présent(s), seed ignoré.`);
    return;
  }

  const realisateurByFirstName = new Map<string, { id: string }>();
  for (const def of REALISATEUR_DEFS) {
    const r = await prisma.realisateur.create({
      data: {
        firstName: def.firstName,
        lastName: def.lastName,
        email: `${def.lastName.toLowerCase()}.${def.firstName.toLowerCase()}@example.com`,
      },
    });
    realisateurByFirstName.set(def.firstName, r);
  }

  const projectByKey = new Map<string, { id: string }>();
  for (const def of PROJECT_DEFS) {
    const p = await prisma.project.create({ data: def });
    projectByKey.set(def.key, p);
  }

  const ticketByKey = new Map<string, { id: string }>();
  const ticketDefByKey = new Map<string, TicketDef>();
  for (const t of TICKET_DEFS) {
    const project = projectByKey.get(t.projectKey);
    const assignee = t.assigneeFirstName ? realisateurByFirstName.get(t.assigneeFirstName) : null;
    if (!project) throw new Error(`Seed incohérent : projet inconnu ${t.projectKey} pour ${t.key}`);

    const ticket = await prisma.ticket.create({
      data: {
        projectId: project.id,
        title: t.title,
        description: t.description,
        status: t.status,
        assigneeId: assignee?.id,
        estimatedMinutes: t.estimatedMinutes,
      },
    });
    ticketByKey.set(t.key, ticket);
    ticketDefByKey.set(t.key, t);
  }

  // Une entrée = une session de travail passée : génère à la fois le
  // rapport (groupé par réalisateur+date, comme le ferait report-api) et
  // le créneau de planning correspondant.
  const reportsByRealisateurAndDate = new Map<string, { id: string }>();
  const spentByTicketKey = new Map<string, number>();

  for (const session of WORK_SESSIONS) {
    const realisateur = realisateurByFirstName.get(session.realisateurFirstName);
    const ticket = ticketByKey.get(session.ticketKey);
    const ticketDef = ticketDefByKey.get(session.ticketKey);
    if (!realisateur || !ticket || !ticketDef) throw new Error(`Seed incohérent pour la session ${JSON.stringify(session)}`);

    const reportKey = `${session.realisateurFirstName}__${session.date}`;
    let report = reportsByRealisateurAndDate.get(reportKey);
    if (!report) {
      report = await prisma.report.create({
        data: {
          realisateurId: realisateur.id,
          date: new Date(`${session.date}T00:00:00.000Z`),
          status: session.date >= "2026-09-08" ? "draft" : "submitted",
        },
      });
      reportsByRealisateurAndDate.set(reportKey, report);
    }

    await prisma.reportEntry.create({
      data: {
        reportId: report.id,
        ticketId: ticket.id,
        date: new Date(`${session.date}T${session.startTime}:00.000Z`),
        duration: session.duration,
        description: session.description,
      },
    });

    await prisma.planningEvent.create({
      data: {
        ticketId: ticket.id,
        realisateurId: realisateur.id,
        title: ticketDef.title,
        date: new Date(`${session.date}T00:00:00.000Z`),
        startTime: session.startTime,
        endTime: addMinutes(session.startTime, session.duration),
        type: "work",
      },
    });

    spentByTicketKey.set(session.ticketKey, (spentByTicketKey.get(session.ticketKey) ?? 0) + session.duration);
  }

  // Créneaux planifiés mais pas encore réalisés : pas d'entry de rapport,
  // pas d'impact sur timeSpentMinutes tant que le travail n'a pas eu lieu.
  for (const plan of FUTURE_PLANS) {
    const realisateur = realisateurByFirstName.get(plan.realisateurFirstName);
    const ticket = ticketByKey.get(plan.ticketKey);
    const ticketDef = ticketDefByKey.get(plan.ticketKey);
    if (!realisateur || !ticket || !ticketDef) throw new Error(`Seed incohérent pour le créneau ${JSON.stringify(plan)}`);

    await prisma.planningEvent.create({
      data: {
        ticketId: ticket.id,
        realisateurId: realisateur.id,
        title: ticketDef.title,
        date: new Date(`${plan.date}T00:00:00.000Z`),
        startTime: plan.startTime,
        endTime: addMinutes(plan.startTime, plan.duration),
        type: "work",
      },
    });
  }

  for (const [key, minutes] of spentByTicketKey) {
    await prisma.ticket.update({ where: { id: ticketByKey.get(key)!.id }, data: { timeSpentMinutes: minutes } });
  }

  console.log(
    `[seed] ${TICKET_DEFS.length} tickets, ${WORK_SESSIONS.length} sessions de travail ` +
      `(${reportsByRealisateurAndDate.size} rapports), ${FUTURE_PLANS.length} créneaux planifiés à venir.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
