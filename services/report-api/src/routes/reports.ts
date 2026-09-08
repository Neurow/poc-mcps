import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const reportsRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["draft", "submitted"] as const;

const realisateurSelect = { id: true, email: true, firstName: true, lastName: true } as const;

const entrySchema = z.object({
  ticketId: z.string().trim().min(1),
  date: z.string().datetime().describe("Début précis de la tâche (ISO 8601 UTC)"),
  duration: z.number().int().positive().describe("Durée en minutes"),
  description: z.string().trim().optional(),
});

function toEntryCreateData(entries: z.infer<typeof entrySchema>[]) {
  return entries.map((e) => ({
    ticketId: e.ticketId,
    date: new Date(e.date),
    duration: e.duration,
    description: e.description,
  }));
}

// Regroupe les durées par ticket (un report peut avoir plusieurs entries
// sur le même ticket) pour n'appliquer qu'un seul incrément/décrément par
// ticket à Ticket.timeSpentMinutes.
function sumDurationByTicket(entries: { ticketId: string; duration: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const e of entries) {
    totals.set(e.ticketId, (totals.get(e.ticketId) ?? 0) + e.duration);
  }
  return totals;
}

async function assertTicketsExist(ticketIds: string[]): Promise<string[] | null> {
  if (ticketIds.length === 0) return null;
  const found = await prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true } });
  const foundIds = new Set(found.map((t) => t.id));
  const unknown = ticketIds.filter((id) => !foundIds.has(id));
  return unknown.length > 0 ? unknown : null;
}

const entryInclude = {
  entries: { orderBy: { date: "asc" as const } },
};

const reportInclude = {
  realisateur: { select: realisateurSelect },
  ...entryInclude,
};

type RealisateurRef = { id: string; email: string; firstName: string; lastName: string };

function toReportDTO(report: {
  id: string;
  date: Date;
  content: string | null;
  status: string;
  realisateur: RealisateurRef;
  createdAt: Date;
  updatedAt: Date;
  entries: { id: string; ticketId: string; date: Date; duration: number; description: string | null }[];
}) {
  return {
    id: report.id,
    date: report.date.toISOString().slice(0, 10),
    content: report.content,
    status: report.status,
    realisateur: report.realisateur,
    entries: report.entries.map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      date: e.date.toISOString(),
      duration: e.duration,
      description: e.description,
    })),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

reportsRouter.get("/:realisateurId/:date", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "invalid_date" });
    return;
  }

  const report = await prisma.report.findUnique({
    where: {
      realisateurId_date: {
        realisateurId: req.params.realisateurId,
        date: new Date(`${req.params.date}T00:00:00.000Z`),
      },
    },
    include: reportInclude,
  });

  if (!report) {
    res.status(404).json({ error: "report_not_found" });
    return;
  }

  res.json(toReportDTO(report));
});

const createReportSchema = z.object({
  realisateurId: z.string().trim().min(1),
  date: z.string().regex(DATE_RE),
  content: z.string().trim().min(1).optional(),
  status: z.enum(STATUSES).optional(),
  entries: z.array(entrySchema).optional(),
});

reportsRouter.post("/", async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { realisateurId, date, content, status, entries } = parsed.data;
  const dateValue = new Date(`${date}T00:00:00.000Z`);
  const entryList = entries ?? [];

  const realisateur = await prisma.realisateur.findUnique({ where: { id: realisateurId } });
  if (!realisateur) {
    res.status(400).json({ error: "unknown_realisateur", realisateurId });
    return;
  }

  const unknownTickets = await assertTicketsExist([...new Set(entryList.map((e) => e.ticketId))]);
  if (unknownTickets) {
    res.status(400).json({ error: "unknown_tickets", ticketIds: unknownTickets });
    return;
  }

  const existing = await prisma.report.findUnique({
    where: { realisateurId_date: { realisateurId, date: dateValue } },
  });
  if (existing) {
    res.status(409).json({ error: "report_already_exists", id: existing.id });
    return;
  }

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.report.create({
      data: {
        realisateurId,
        date: dateValue,
        content,
        status: status ?? "draft",
        entries: { create: toEntryCreateData(entryList) },
      },
      include: reportInclude,
    });

    for (const [ticketId, minutes] of sumDurationByTicket(entryList)) {
      await tx.ticket.update({ where: { id: ticketId }, data: { timeSpentMinutes: { increment: minutes } } });
    }

    return created;
  });

  res.status(201).json(toReportDTO(report));
});

const updateReportSchema = z.object({
  content: z.string().trim().min(1).optional(),
  status: z.enum(STATUSES).optional(),
  entries: z.array(entrySchema).optional(),
});

reportsRouter.patch("/:id", async (req, res) => {
  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  const exists = await prisma.report.findUnique({ where: { id: req.params.id }, include: entryInclude });
  if (!exists) {
    res.status(404).json({ error: "report_not_found" });
    return;
  }

  const { content, status, entries } = parsed.data;

  if (entries) {
    const unknownTickets = await assertTicketsExist([...new Set(entries.map((e) => e.ticketId))]);
    if (unknownTickets) {
      res.status(400).json({ error: "unknown_tickets", ticketIds: unknownTickets });
      return;
    }
  }

  // Quand `entries` est fourni, il remplace entièrement le jeu existant
  // (pas de fusion partielle) — plus simple et suffisant pour ce POC, le
  // Skill régénère de toute façon le rapport complet à chaque fois. On
  // décrémente donc d'abord Ticket.timeSpentMinutes des entries qui
  // disparaissent, puis on l'incrémente des nouvelles — dans une seule
  // transaction pour rester cohérent si ça échoue en cours de route.
  const report = await prisma.$transaction(async (tx) => {
    if (entries) {
      for (const [ticketId, minutes] of sumDurationByTicket(exists.entries)) {
        await tx.ticket.update({ where: { id: ticketId }, data: { timeSpentMinutes: { increment: -minutes } } });
      }
    }

    const updated = await tx.report.update({
      where: { id: req.params.id },
      data: {
        content,
        status,
        ...(entries && { entries: { deleteMany: {}, create: toEntryCreateData(entries) } }),
      },
      include: reportInclude,
    });

    if (entries) {
      for (const [ticketId, minutes] of sumDurationByTicket(entries)) {
        await tx.ticket.update({ where: { id: ticketId }, data: { timeSpentMinutes: { increment: minutes } } });
      }
    }

    return updated;
  });

  res.json(toReportDTO(report));
});
