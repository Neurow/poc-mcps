import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const ticketsRouter = Router();

const STATUSES = ["open", "in_progress", "closed"] as const;

const realisateurSelect = { id: true, email: true, firstName: true, lastName: true } as const;

const ticketInclude = {
  project: { select: { key: true, name: true } },
  assignee: { select: realisateurSelect },
} as const;

const commentInclude = {
  author: { select: realisateurSelect },
} as const;

type RealisateurRef = { id: string; email: string; firstName: string; lastName: string };

function toTicketDTO(ticket: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee: RealisateurRef | null;
  estimatedMinutes: number | null;
  timeSpentMinutes: number;
  createdAt: Date;
  updatedAt: Date;
  project: { key: string; name: string };
  comments?: { id: string; author: RealisateurRef; body: string; createdAt: Date }[];
}) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    assignee: ticket.assignee,
    estimatedMinutes: ticket.estimatedMinutes,
    timeSpentMinutes: ticket.timeSpentMinutes,
    project: ticket.project,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    ...(ticket.comments && {
      comments: ticket.comments.map((c) => ({
        id: c.id,
        author: c.author,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    }),
  };
}

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(STATUSES).optional(),
  projectKey: z.string().trim().min(1).optional(),
});

ticketsRouter.get("/", async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", details: parsed.error.flatten() });
    return;
  }
  const { q, status, projectKey } = parsed.data;

  const tickets = await prisma.ticket.findMany({
    where: {
      status,
      project: projectKey ? { key: projectKey } : undefined,
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json(tickets.map(toTicketDTO));
});

ticketsRouter.get("/:id", async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { ...ticketInclude, comments: { include: commentInclude, orderBy: { createdAt: "asc" } } },
  });

  if (!ticket) {
    res.status(404).json({ error: "ticket_not_found" });
    return;
  }

  res.json(toTicketDTO(ticket));
});

const createTicketSchema = z.object({
  projectKey: z.string().trim().min(1),
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  assigneeId: z.string().trim().min(1).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
});

ticketsRouter.post("/", async (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { projectKey, title, description, assigneeId, estimatedMinutes } = parsed.data;

  const project = await prisma.project.findUnique({ where: { key: projectKey } });
  if (!project) {
    res.status(400).json({ error: "unknown_project", projectKey });
    return;
  }

  if (assigneeId) {
    const assignee = await prisma.realisateur.findUnique({ where: { id: assigneeId } });
    if (!assignee) {
      res.status(400).json({ error: "unknown_assignee", assigneeId });
      return;
    }
  }

  const ticket = await prisma.ticket.create({
    data: { projectId: project.id, title, description, assigneeId, estimatedMinutes },
    include: ticketInclude,
  });

  res.status(201).json(toTicketDTO(ticket));
});

const updateTicketSchema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().optional(),
  status: z.enum(STATUSES).optional(),
  assigneeId: z.string().trim().min(1).nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
});

ticketsRouter.patch("/:id", async (req, res) => {
  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ error: "ticket_not_found" });
    return;
  }

  if (parsed.data.assigneeId) {
    const assignee = await prisma.realisateur.findUnique({ where: { id: parsed.data.assigneeId } });
    if (!assignee) {
      res.status(400).json({ error: "unknown_assignee", assigneeId: parsed.data.assigneeId });
      return;
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: ticketInclude,
  });

  res.json(toTicketDTO(ticket));
});

const addCommentSchema = z.object({
  authorId: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

ticketsRouter.post("/:id/comments", async (req, res) => {
  const parsed = addCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ error: "ticket_not_found" });
    return;
  }

  const author = await prisma.realisateur.findUnique({ where: { id: parsed.data.authorId } });
  if (!author) {
    res.status(400).json({ error: "unknown_author", authorId: parsed.data.authorId });
    return;
  }

  await prisma.ticketComment.create({
    data: { ticketId: req.params.id, authorId: parsed.data.authorId, body: parsed.data.body },
  });

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { ...ticketInclude, comments: { include: commentInclude, orderBy: { createdAt: "asc" } } },
  });

  res.status(201).json(toTicketDTO(ticket));
});
