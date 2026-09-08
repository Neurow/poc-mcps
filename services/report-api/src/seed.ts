import { faker } from "@faker-js/faker";
import { prisma } from "./db.js";

function dateAtDayOffset(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
}

async function main() {
  const existing = await prisma.report.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} rapport(s) déjà présents, seed ignoré.`);
    return;
  }

  // Rapports pour les jours 5 à 9 uniquement : les 4 derniers jours (dont
  // "hier") restent volontairement sans rapport pour la démo du Skill
  // daily-report, qui doit pouvoir en créer un.
  const SLOTS = [
    ["09:00", "10:30"],
    ["10:30", "12:00"],
    ["14:00", "15:30"],
  ];

  for (let offset = 5; offset < 10; offset++) {
    const entryCount = faker.number.int({ min: 1, max: 3 });
    const slots = faker.helpers.shuffle(SLOTS).slice(0, entryCount);

    await prisma.report.create({
      data: {
        date: dateAtDayOffset(offset),
        content: `## Synthèse du jour\n\n${faker.lorem.paragraphs(2, "\n\n")}`,
        status: faker.helpers.arrayElement(["draft", "submitted"]),
        entries: {
          create: slots.map(([startTime, endTime]) => ({
            ticketId: faker.string.alphanumeric(20),
            startTime,
            endTime,
            description: faker.hacker.phrase(),
          })),
        },
      },
    });
  }

  console.log("[seed] Données fictives générées.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
