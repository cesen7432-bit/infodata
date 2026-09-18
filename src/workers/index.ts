import { logger } from "../lib/logger";
import { ALL_SOURCES } from "../scrapers/registry";
import { createSourceWorker } from "./genericWorker";
import { createSriInvoiceWorker } from "./sriInvoiceWorker";

// Un Worker BullMQ por fuente (datadiverservice, satje, sri, ant), cada
// uno con su propia concurrencia configurada en las variables de entorno
// QUEUE_CONCURRENCY_* (plan, sección 09).
const workers = [...ALL_SOURCES.map((source) => createSourceWorker(source)), createSriInvoiceWorker()];

logger.info(`Workers activos: ${workers.length} (${ALL_SOURCES.join(", ")}, sri-invoices)`);

process.on("SIGTERM", async () => {
  logger.info("Cerrando workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
