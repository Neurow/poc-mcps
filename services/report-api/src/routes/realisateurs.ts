import { Router } from "express";
import { prisma } from "../db.js";

export const realisateursRouter = Router();

realisateursRouter.get("/", async (_req, res) => {
  const realisateurs = await prisma.realisateur.findMany({
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  res.json(realisateurs);
});
