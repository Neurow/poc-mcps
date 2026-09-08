import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const planningRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_TYPES = ["work", "meeting"] as const;

const realisateurSelect = { id: true, email: true, firstName: true, lastName: true } as const;

const eventInclude = {
  ticket: { select: { id: true, title: true, project: { select: { key: true, name: true } } } },
  realisateur: { select: realisateurSelect },
} as const;

type RealisateurRef = { id: string; email: string; firstName: string; lastName: string };

function toEventDTO(event: {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: string;
  ticketId: string;
  ticket: { id: string; title: string; project: { key: string; name: string } };
  realisateur: RealisateurRef;
}) {
  return {
    id: event.id,
    title: event.title,
    date: event.date.toISOString().slice(0, 10),
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    ticketId: event.ticketId,
    project: event.ticket.project,
    realisateur: event.realisateur,
  };
}

function dayBounds(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

const listQuerySchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  projectKey: z.string().trim().min(1).optional(),
});

planningRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    return;
  }
  const { date, from, to, projectKey } = parsed.data;

  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (date) {
    const { start, end } = dayBounds(date);
    dateFilter = { gte: start, lt: end };
  } else if (from || to) {
    dateFilter = {
      gte: from ? dayBounds(from).start : dayBounds("0001-01-01").start,
      lt: to ? dayBounds(to).end : dayBounds("9999-12-31").end,
    };
  }

  const events = await prisma.planningEvent.findMany({
    where: {
      date: dateFilter,
      ticket: projectKey ? { project: { key: projectKey } } : undefined,
    },
    include: eventInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 200,
  });

  res.json(events.map(toEventDTO));
});

planningRouter.get("/:id", async (req, res) => {
  const event = await prisma.planningEvent.findUnique({
    where: { id: req.params.id },
    include: eventInclude,
  });

  if (!event) {
    res.status(404).json({ error: "event_not_found" });
    return;
  }

  res.json(toEventDTO(event));
});

const createEventSchema = z.object({
  ticketId: z.string().trim().min(1),
  realisateurId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  date: z.string().regex(DATE_RE),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  type: z.enum(EVENT_TYPES).optional(),
});

planningRouter.post("/", async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { ticketId, realisateurId, title, date, startTime, endTime, type } = parsed.data;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(400).json({ error: "unknown_ticket", ticketId });
    return;
  }

  const realisateur = await prisma.realisateur.findUnique({ where: { id: realisateurId } });
  if (!realisateur) {
    res.status(400).json({ error: "unknown_realisateur", realisateurId });
    return;
  }

  const event = await prisma.planningEvent.create({
    data: {
      ticketId,
      realisateurId,
      title,
      date: dayBounds(date).start,
      startTime,
      endTime,
      type: type ?? "work",
    },
    include: eventInclude,
  });

  res.status(201).json(toEventDTO(event));
});

const updateEventSchema = z.object({
  date: z.string().regex(DATE_RE).optional(),
  startTime: z.string().trim().min(1).optional(),
  endTime: z.string().trim().min(1).optional(),
  type: z.enum(EVENT_TYPES).optional(),
});

planningRouter.patch("/:id", async (req, res) => {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  const exists = await prisma.planningEvent.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ error: "event_not_found" });
    return;
  }

  const { date, startTime, endTime, type } = parsed.data;

  const event = await prisma.planningEvent.update({
    where: { id: req.params.id },
    data: {
      date: date ? dayBounds(date).start : undefined,
      startTime,
      endTime,
      type,
    },
    include: eventInclude,
  });

  res.json(toEventDTO(event));
});
