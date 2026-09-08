import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const reportsRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const STATUSES = ["draft", "submitted"] as const;

const entrySchema = z.object({
  ticketId: z.string().trim().min(1),
  startTime: z.string().regex(TIME_RE),
  endTime: z.string().regex(TIME_RE),
  description: z.string().trim().optional(),
});

const entryInclude = {
  entries: { orderBy: { startTime: "asc" as const } },
};

function toReportDTO(report: {
  id: string;
  date: Date;
  content: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  entries: { id: string; ticketId: string; startTime: string; endTime: string; description: string | null }[];
}) {
  return {
    id: report.id,
    date: report.date.toISOString().slice(0, 10),
    content: report.content,
    status: report.status,
    entries: report.entries.map((e) => ({
      id: e.id,
      ticketId: e.ticketId,
      startTime: e.startTime,
      endTime: e.endTime,
      description: e.description,
    })),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

reportsRouter.get("/:date", async (req, res) => {
  if (!DATE_RE.test(req.params.date)) {
    res.status(400).json({ error: "invalid_date" });
    return;
  }

  const report = await prisma.report.findUnique({
    where: { date: new Date(`${req.params.date}T00:00:00.000Z`) },
    include: entryInclude,
  });

  if (!report) {
    res.status(404).json({ error: "report_not_found" });
    return;
  }

  res.json(toReportDTO(report));
});

const createReportSchema = z.object({
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
  const { date, content, status, entries } = parsed.data;
  const dateValue = new Date(`${date}T00:00:00.000Z`);

  const existing = await prisma.report.findUnique({ where: { date: dateValue } });
  if (existing) {
    res.status(409).json({ error: "report_already_exists", id: existing.id });
    return;
  }

  const report = await prisma.report.create({
    data: {
      date: dateValue,
      content,
      status: status ?? "draft",
      entries: { create: entries ?? [] },
    },
    include: entryInclude,
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

  const exists = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!exists) {
    res.status(404).json({ error: "report_not_found" });
    return;
  }

  const { content, status, entries } = parsed.data;

  // Quand `entries` est fourni, il remplace entièrement le jeu existant
  // (pas de fusion partielle) — plus simple et suffisant pour ce POC,
  // le Skill régénère de toute façon le rapport complet à chaque fois.
  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: {
      content,
      status,
      ...(entries && { entries: { deleteMany: {}, create: entries } }),
    },
    include: entryInclude,
  });

  res.json(toReportDTO(report));
});
