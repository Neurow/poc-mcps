import { faker } from "@faker-js/faker";
import { prisma } from "./db.js";

// Doit rester aligné avec les clés de projet de Ticket API (systèmes
// indépendants, chacun sa copie des projets connus).
const PROJECT_DEFS = [
  { key: "NOVA", name: "Nova (suivi de budget — desktop & mobile)" },
  { key: "API", name: "Plateforme API interne" },
];

const EVENT_TYPES = ["work", "meeting"] as const;
const SLOTS = [
  ["09:00", "10:30"],
  ["10:30", "12:00"],
  ["14:00", "15:30"],
  ["15:30", "17:00"],
];

function dateAtDayOffset(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

interface TicketRef {
  id: string;
  project: { key: string };
}

// Le seed est volontairement partagé avec Ticket API : on va y chercher
// les vrais tickets (mêmes credentials, même modèle d'auth que le MCP)
// pour que les `ticketId` générés ici référencent de vrais tickets, pas
// des chaînes aléatoires. Ticket API ne démarre son serveur HTTP qu'une
// fois son propre seed terminé (voir son entrypoint.sh), donc dès que
// `/health` répond, ses données sont prêtes.
async function waitForTicketApi(baseUrl: string, retries = 20, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // ticket-api pas encore prêt, on retente
    }
    console.log(`[seed] en attente de ticket-api... (${attempt}/${retries})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("ticket-api indisponible après plusieurs tentatives");
}

async function fetchTicketIdsByProject(ticketApiUrl: string, portalToken: string): Promise<Map<string, string[]>> {
  await waitForTicketApi(ticketApiUrl);

  const authRes = await fetch(`${ticketApiUrl}/auth/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ portalToken }),
  });
  if (!authRes.ok) {
    throw new Error(`Échange de token avec ticket-api échoué (${authRes.status}): ${await authRes.text()}`);
  }
  const { token } = (await authRes.json()) as { token: string };

  const ticketsRes = await fetch(`${ticketApiUrl}/tickets`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!ticketsRes.ok) {
    throw new Error(`Lecture des tickets échouée (${ticketsRes.status}): ${await ticketsRes.text()}`);
  }
  const tickets = (await ticketsRes.json()) as TicketRef[];

  const byProject = new Map<string, string[]>();
  for (const t of tickets) {
    const list = byProject.get(t.project.key) ?? [];
    list.push(t.id);
    byProject.set(t.project.key, list);
  }
  return byProject;
}

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} projet(s) déjà présents, seed ignoré.`);
    return;
  }

  const ticketApiUrl = process.env.TICKET_API_URL;
  const portalToken = process.env.PORTAL_TOKEN;
  if (!ticketApiUrl || !portalToken) {
    throw new Error("TICKET_API_URL et PORTAL_TOKEN sont requis pour seeder Planning avec de vrais tickets");
  }
  const ticketIdsByProject = await fetchTicketIdsByProject(ticketApiUrl, portalToken);

  const projects = [];
  for (const def of PROJECT_DEFS) {
    projects.push(await prisma.project.create({ data: def }));
  }

  // 10 derniers jours (offset 0 = aujourd'hui, 1 = hier, ...). "Hier" est
  // volontairement garanti non-vide pour la démo du Skill daily-report.
  for (let offset = 0; offset < 10; offset++) {
    const date = dateAtDayOffset(offset);

    for (const project of projects) {
      const eventCount = offset === 1 ? faker.number.int({ min: 2, max: 3 }) : faker.number.int({ min: 0, max: 3 });
      const usedSlots = faker.helpers.shuffle(SLOTS).slice(0, eventCount);
      const projectTicketIds = ticketIdsByProject.get(project.key) ?? [];
      // "Hier" a plus de chances d'être lié à un ticket réel, pour que la
      // démo du Skill ait toujours de la matière à reconstruire.
      const ticketProbability = offset === 1 ? 0.7 : 0.3;

      for (const [startTime, endTime] of usedSlots) {
        const hasTicket = projectTicketIds.length > 0 && faker.datatype.boolean({ probability: ticketProbability });

        await prisma.planningEvent.create({
          data: {
            projectId: project.id,
            title: faker.hacker.phrase(),
            date,
            startTime,
            endTime,
            type: faker.helpers.arrayElement(EVENT_TYPES),
            ticketId: hasTicket ? faker.helpers.arrayElement(projectTicketIds) : null,
          },
        });
      }
    }
  }

  console.log("[seed] Données fictives générées (ticketId réels référencés depuis Ticket API).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
