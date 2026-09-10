import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  REDIS_URL: z.string().min(1, "REDIS_URL es requerido"),

  SESSION_TTL_HOURS: z.coerce.number().default(8),

  DATADIVERSERVICE_USER: z.string().default(""),
  DATADIVERSERVICE_PASS: z.string().default(""),
  DATADIVERSERVICE_BASE_URL: z.string().default("https://datadiverservice.com"),
  DATADIVERSERVICE_API_URL: z.string().default("https://api.datadiverservice.com"),
  QUEUE_CONCURRENCY_DATADIVERSERVICE: z.coerce.number().default(5),

  SATJE_API_BASE: z.string().default("https://api.funcionjudicial.gob.ec"),
  QUEUE_CONCURRENCY_SATJE: z.coerce.number().default(5),

  SRI_BASE_URL: z.string().default("https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc"),
  SRI_CONTRIBUYENTE_URL: z
    .string()
    .default("https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc"),
  SRI_ESTABLECIMIENTOS_URL: z
    .string()
    .default("https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/Establecimiento/consultarPorNumeroRuc"),
  QUEUE_CONCURRENCY_SRI: z.coerce.number().default(2),

  ANT_URL: z.string().default("https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_grid_citaciones.jsp"),
  QUEUE_CONCURRENCY_ANT: z.coerce.number().default(2),

  RP_LOGIN_URL: z.string().default("https://www.rplojavirtual.gob.ec/login.xhtml"),
  RP_CONSULTA_URL: z.string().default("https://www.rplojavirtual.gob.ec/public/bienInmueble.xhtml"),
  RP_USERNAME: z.string().default(""),
  RP_PASSWORD: z.string().default(""),
  QUEUE_CONCURRENCY_RP: z.coerce.number().default(1),

  HEADLESS: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
