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
  // [heure de début, minute de début, durée en minutes]
  const SLOTS: [number, number, number][] = [
    [9, 0, 90],
    [10, 30, 90],
    [14, 0, 90],
  ];

  for (let offset = 5; offset < 10; offset++) {
    const entryCount = faker.number.int({ min: 1, max: 3 });
    const slots = faker.helpers.shuffle(SLOTS).slice(0, entryCount);
    const day = dateAtDayOffset(offset);

    await prisma.report.create({
      data: {
        date: day,
        content: `## Synthèse du jour\n\n${faker.lorem.paragraphs(2, "\n\n")}`,
        status: faker.helpers.arrayElement(["draft", "submitted"]),
        entries: {
          create: slots.map(([hour, minute, duration]) => {
            const entryDate = new Date(day);
            entryDate.setUTCHours(hour, minute, 0, 0);
            return {
              ticketId: faker.string.alphanumeric(20),
              date: entryDate,
              duration,
              description: faker.hacker.phrase(),
            };
          }),
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
