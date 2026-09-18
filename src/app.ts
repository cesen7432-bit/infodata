import path from "path";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authRouter } from "./auth/auth.routes";
import { usersRouter } from "./users/users.routes";
import { consultaRouter } from "./consulta/consulta.routes";
import { bulkRouter } from "./admin/bulk.routes";
import { apiKeysRouter } from "./admin/apiKeys.routes";
import { exportRouter } from "./admin/export.routes";
import { logger } from "./lib/logger";

// El build de la SPA (web/dist) vive al mismo nivel que src/ y dist/, así
// que esta ruta relativa sirve tanto en dev (ts-node-dev desde src/) como
// compilado (node desde dist/).
const WEB_DIST = path.join(__dirname, "../web/dist");

export const app = express();

// Detrás de un único proxy inverso (Apache, ver docker-compose.yml) — sin
// esto, Express no confía en X-Forwarded-For y express-rate-limit no puede
// identificar la IP real de cada usuario (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
// "1" = confía solo en el primer hop, no en toda la cadena que un cliente
// podría falsear agregando sus propios X-Forwarded-For.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

// A ~500 consultas/día un límite generoso alcanza para frenar abuso sin
// estorbar el uso normal (plan, sección 00 — parámetros operativos).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/admin/users", usersRouter);
app.use("/api/admin/api-keys", apiKeysRouter);
app.use("/api/admin/consulta-masiva", bulkRouter);
app.use("/api/admin/export", exportRouter);
app.use("/api/consulta", consultaRouter);

// Estáticos de la SPA + fallback de rutas de cliente (React Router). Se
// excluye solo lo que empieza con "/api/" (con la barra) — así una ruta de
// API mal escrita sigue dando 404 JSON, pero una ruta de cliente como
// "/api-keys" (que NO es "/api/...") se sirve como SPA sin problema.
app.use(express.static(WEB_DIST));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Error no manejado", { error: err.message, stack: err.stack });
  // Una respuesta que ya empezó a transmitirse (p.ej. el streaming del
  // export a Excel) no puede reiniciar sus headers — delegar a Express, que
  // simplemente cierra la conexión.
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
