import { env } from "./config/env";
import { app } from "./app";
import { logger } from "./lib/logger";

app.listen(env.PORT, () => {
  logger.info(`API escuchando en :${env.PORT} (${env.NODE_ENV})`);
});
