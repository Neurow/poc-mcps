import { faker } from "@faker-js/faker";
import { prisma } from "./db.js";

const PROJECT_DEFS = [
  { key: "WEB", name: "Site web public" },
  { key: "MOBILE", name: "Application mobile" },
  { key: "API", name: "Plateforme API interne" },
];

const STATUSES = ["open", "in_progress", "closed"] as const;

async function main() {
  const existing = await prisma.project.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} projet(s) déjà présents, seed ignoré.`);
    return;
  }

  for (const def of PROJECT_DEFS) {
    const project = await prisma.project.create({ data: def });

    const ticketCount = faker.number.int({ min: 6, max: 12 });
    for (let i = 0; i < ticketCount; i++) {
      const ticket = await prisma.ticket.create({
        data: {
          projectId: project.id,
          title: faker.hacker.phrase(),
          description: faker.lorem.sentences(2),
          status: faker.helpers.arrayElement(STATUSES),
          assignee: faker.person.firstName(),
        },
      });

      if (faker.datatype.boolean({ probability: 0.4 })) {
        await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            author: faker.person.firstName(),
            body: faker.lorem.sentence(),
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
