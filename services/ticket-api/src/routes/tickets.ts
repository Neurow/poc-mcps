import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const ticketsRouter = Router();

const STATUSES = ["open", "in_progress", "closed"] as const;

const ticketInclude = {
  project: { select: { key: true, name: true } },
} as const;

function toTicketDTO(ticket: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee: string | null;
  createdAt: Date;
  updatedAt: Date;
  project: { key: string; name: string };
  comments?: { author: string; body: string; createdAt: Date }[];
}) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    assignee: ticket.assignee,
    project: ticket.project,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    ...(ticket.comments && {
      comments: ticket.comments.map((c) => ({
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
    include: { ...ticketInclude, comments: { orderBy: { createdAt: "asc" } } },
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
});

ticketsRouter.post("/", async (req, res) => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { projectKey, title, description } = parsed.data;

  const project = await prisma.project.findUnique({ where: { key: projectKey } });
  if (!project) {
    res.status(400).json({ error: "unknown_project", projectKey });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: { projectId: project.id, title, description },
    include: ticketInclude,
  });

  res.status(201).json(toTicketDTO(ticket));
});

const updateTicketSchema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().optional(),
  status: z.enum(STATUSES).optional(),
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

  const ticket = await prisma.ticket.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: ticketInclude,
  });

  res.json(toTicketDTO(ticket));
});

const addCommentSchema = z.object({
  author: z.string().trim().min(1),
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

  await prisma.ticketComment.create({
    data: { ticketId: req.params.id, ...parsed.data },
  });

  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { ...ticketInclude, comments: { orderBy: { createdAt: "asc" } } },
  });

  res.status(201).json(toTicketDTO(ticket));
});
