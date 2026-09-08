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

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} projet(s) déjà présents, seed ignoré.`);
    return;
  }

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

      for (const [startTime, endTime] of usedSlots) {
        await prisma.planningEvent.create({
          data: {
            projectId: project.id,
            title: faker.hacker.phrase(),
            date,
            startTime,
            endTime,
            type: faker.helpers.arrayElement(EVENT_TYPES),
            ticketId: faker.datatype.boolean({ probability: 0.3 }) ? faker.string.alphanumeric(20) : null,
          },
        });
      }
    }
  }

  console.log("[seed] Données fictives générées.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
