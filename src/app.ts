import path from "path";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRouter } from "./auth/auth.routes";
import { usersRouter } from "./users/users.routes";
import { consultaRouter } from "./consulta/consulta.routes";
import { bulkRouter } from "./admin/bulk.routes";
import { apiKeysRouter } from "./admin/apiKeys.routes";
import { logger } from "./lib/logger";

// El build de la SPA (web/dist) vive al mismo nivel que src/ y dist/, así
// que esta ruta relativa sirve tanto en dev (ts-node-dev desde src/) como
// compilado (node desde dist/).
const WEB_DIST = path.join(__dirname, "../web/dist");

export const app = express();

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

// Todo cuelga de este router. En producción, detrás de un proxy que no recorta
// la ruta (Apache `<Location /infodata>`), se monta en BASE_PATH y la app
// responde en "/infodata/..."; sin BASE_PATH se monta en la raíz.
const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/api/auth", authRouter);
router.use("/api/admin/users", usersRouter);
router.use("/api/admin/api-keys", apiKeysRouter);
router.use("/api/admin/consulta-masiva", bulkRouter);
router.use("/api/consulta", consultaRouter);

// Estáticos de la SPA + fallback de rutas de cliente (React Router). Se
// excluye solo lo que empieza con "/api/" (con la barra) — así una ruta de
// API mal escrita sigue dando 404 JSON, pero una ruta de cliente como
// "/api-keys" (que NO es "/api/...") se sirve como SPA sin problema.
router.use(express.static(WEB_DIST));
router.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.method !== "GET") return next();
  res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
    if (err) next();
  });
});

app.use(env.BASE_PATH || "/", router);

// Con BASE_PATH, una petición fuera del prefijo (incluida la raíz "/") no
// llega al router — la redirigimos al prefijo en vez de dar un 404 seco.
if (env.BASE_PATH) {
  app.get("/", (_req, res) => res.redirect(`${env.BASE_PATH}/`));
}

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Error no manejado", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Error interno del servidor" });
});
