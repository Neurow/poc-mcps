import { prisma } from "./db.js";

// Deux projets réalistes : NOVA est un seul produit avec un client
// desktop et un client mobile (pas deux projets séparés) ; API est la
// plateforme backend interne qui l'alimente.
const PROJECT_DEFS = [
  { key: "NOVA", name: "Nova (suivi de budget — desktop & mobile)" },
  { key: "API", name: "Plateforme API interne" },
];

interface TicketSeed {
  title: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  assignee: string;
  comments?: { author: string; body: string }[];
}

const NOVA_TICKETS: TicketSeed[] = [
  {
    title: "Le solde du compte ne se met pas à jour après une synchronisation manuelle sur mobile",
    description:
      "Après avoir tiré pour rafraîchir sur l'app mobile, le solde affiché reste celui d'avant la " +
      "synchronisation pendant plusieurs secondes, ce qui peut induire l'utilisateur en erreur.",
    status: "open",
    assignee: "Camille Dubois",
    comments: [
      { author: "Antoine Bernard", body: "Je confirme le problème sur mon Pixel 7, le délai est d'environ 8 secondes." },
    ],
  },
  {
    title: "Crash au démarrage de l'application desktop sous Windows 11",
    description:
      "Plusieurs utilisateurs signalent un crash immédiat au lancement sur Windows 11 après la " +
      "dernière mise à jour. Le crash ne se reproduit pas sous Windows 10.",
    status: "in_progress",
    assignee: "Antoine Bernard",
    comments: [
      {
        author: "Camille Dubois",
        body: "Les logs montrent une exception liée au driver graphique, on dirait un souci avec la dernière version d'Electron.",
      },
    ],
  },
  {
    title: "Ajouter la possibilité d'exporter les transactions en CSV",
    description: "Fonctionnalité demandée par plusieurs utilisateurs pour importer leurs transactions dans un tableur externe.",
    status: "open",
    assignee: "Camille Dubois",
  },
  {
    title: "Le mode sombre ne s'applique pas correctement aux graphiques de dépenses sur mobile",
    description: "Les graphiques camembert restent sur fond blanc en mode sombre, ce qui rend certains textes illisibles.",
    status: "in_progress",
    assignee: "Léa Petit",
  },
  {
    title: "Notification push envoyée deux fois lors de l'ajout d'une transaction récurrente",
    description: "Corrigé en désactivant le double déclenchement du worker de planification.",
    status: "closed",
    assignee: "Antoine Bernard",
  },
  {
    title: "Impossible de scanner un reçu avec l'appareil photo sur certains téléphones Android",
    description:
      "Le scanner de reçus ne détecte aucun texte sur les appareils Android équipés d'anciens capteurs. " +
      "À investiguer avec l'équipe OCR.",
    status: "open",
    assignee: "Léa Petit",
  },
];

const API_TICKETS: TicketSeed[] = [
  {
    title: "L'endpoint /transactions renvoie une erreur 500 quand le filtre de date est vide",
    description: "Le paramètre 'from' n'est pas correctement validé et provoque une exception non gérée côté serveur.",
    status: "open",
    assignee: "Julien Moreau",
    comments: [
      { author: "Sophie Lambert", body: "Je peux reproduire en local, le souci vient bien de la validation Zod du query param." },
    ],
  },
  {
    title: "Ajouter un rate limiting sur les endpoints d'authentification",
    description: "Nécessaire pour se prémunir contre les attaques par force brute sur /auth/login.",
    status: "in_progress",
    assignee: "Sophie Lambert",
  },
  {
    title: "Documenter les nouveaux endpoints de la v2 dans le Swagger",
    description: "La documentation OpenAPI n'a pas été mise à jour depuis le passage à la v2 de l'API.",
    status: "open",
    assignee: "Julien Moreau",
  },
  {
    title: "Migration de la base de données vers PostgreSQL 16",
    description: "Migration effectuée avec succès sur l'environnement de staging, aucun incident constaté.",
    status: "closed",
    assignee: "Sophie Lambert",
  },
  {
    title: "Fuite mémoire suspectée sur le service de génération de rapports",
    description: "La consommation mémoire du service augmente progressivement sans jamais redescendre. À profiler en priorité.",
    status: "in_progress",
    assignee: "Julien Moreau",
    comments: [
      { author: "Julien Moreau", body: "Ajout d'un dashboard Grafana pour suivre l'évolution de la RSS, premiers résultats dans la journée." },
    ],
  },
];

async function seedProjectTickets(projectKey: string, tickets: TicketSeed[]) {
  const project = await prisma.project.findUniqueOrThrow({ where: { key: projectKey } });

  for (const t of tickets) {
    const ticket = await prisma.ticket.create({
      data: {
        projectId: project.id,
        title: t.title,
        description: t.description,
        status: t.status,
        assignee: t.assignee,
      },
    });

    for (const comment of t.comments ?? []) {
      await prisma.ticketComment.create({
        data: { ticketId: ticket.id, author: comment.author, body: comment.body },
      });
    }
  }
}

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} projet(s) déjà présents, seed ignoré.`);
    return;
  }

  for (const def of PROJECT_DEFS) {
    await prisma.project.create({ data: def });
  }

  await seedProjectTickets("NOVA", NOVA_TICKETS);
  await seedProjectTickets("API", API_TICKETS);

  console.log("[seed] Données fictives générées.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
