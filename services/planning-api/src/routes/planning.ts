import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const planningRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toEventDTO(event: {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: string;
  ticketId: string | null;
  project: { key: string; name: string };
}) {
  return {
    id: event.id,
    title: event.title,
    date: event.date.toISOString().slice(0, 10),
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    ticketId: event.ticketId,
    project: event.project,
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
      project: projectKey ? { key: projectKey } : undefined,
    },
    include: { project: { select: { key: true, name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 200,
  });

  res.json(events.map(toEventDTO));
});

planningRouter.get("/:id", async (req, res) => {
  const event = await prisma.planningEvent.findUnique({
    where: { id: req.params.id },
    include: { project: { select: { key: true, name: true } } },
  });

  if (!event) {
    res.status(404).json({ error: "event_not_found" });
    return;
  }

  res.json(toEventDTO(event));
});
