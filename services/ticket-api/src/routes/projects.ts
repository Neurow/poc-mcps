import { Router } from "express";
import { prisma } from "../db.js";

export const projectsRouter = Router();

projectsRouter.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    select: { key: true, name: true },
    orderBy: { key: "asc" },
  });
  res.json(projects);
});
