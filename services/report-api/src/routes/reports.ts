import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const reportsRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ["draft", "submitted"] as const;

function toReportDTO(report: {
  id: string;
  date: Date;
  content: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: report.id,
    date: report.date.toISOString().slice(0, 10),
    content: report.content,
    status: report.status,
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
  });

  if (!report) {
    res.status(404).json({ error: "report_not_found" });
    return;
  }

  res.json(toReportDTO(report));
});

const createReportSchema = z.object({
  date: z.string().regex(DATE_RE),
  content: z.string().trim().min(1),
  status: z.enum(STATUSES).optional(),
});

reportsRouter.post("/", async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { date, content, status } = parsed.data;
  const dateValue = new Date(`${date}T00:00:00.000Z`);

  const existing = await prisma.report.findUnique({ where: { date: dateValue } });
  if (existing) {
    res.status(409).json({ error: "report_already_exists", id: existing.id });
    return;
  }

  const report = await prisma.report.create({
    data: { date: dateValue, content, status: status ?? "draft" },
  });

  res.status(201).json(toReportDTO(report));
});

const updateReportSchema = z.object({
  content: z.string().trim().min(1).optional(),
  status: z.enum(STATUSES).optional(),
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

  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json(toReportDTO(report));
});
