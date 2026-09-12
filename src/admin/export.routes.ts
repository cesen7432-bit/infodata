import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { buildPersonsWorkbook } from "./export.service";

export const exportRouter = Router();

exportRouter.use(requireAuth, requireRole(Role.ADMIN));

exportRouter.get(
  "/excel",
  asyncHandler(async (_req, res) => {
    const workbook = await buildPersonsWorkbook();
    const today = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="infodata-export-${today}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  })
);
