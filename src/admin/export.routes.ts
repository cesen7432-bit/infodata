import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { EXPORT_SHEETS, isExportSheetKey, writePersonsWorkbook } from "./export.service";

export const exportRouter = Router();

exportRouter.use(requireAuth, requireRole(Role.ADMIN));

exportRouter.get(
  "/excel",
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.sheets === "string" ? req.query.sheets : "";
    const requested = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const unknown = requested.filter((key) => !isExportSheetKey(key));
    if (unknown.length > 0) {
      res.status(400).json({ error: `Sección desconocida: ${unknown.join(", ")}` });
      return;
    }
    if (raw && requested.length === 0) {
      res.status(400).json({ error: "Debe seleccionar al menos una sección" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="infodata-export-${today}.xlsx"`);

    await writePersonsWorkbook(res, requested);
  })
);

exportRouter.get(
  "/sheets",
  asyncHandler(async (_req, res) => {
    res.json({ sheets: EXPORT_SHEETS });
  })
);
