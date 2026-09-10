import IORedis from "ioredis";
import { env } from "../config/env";

// maxRetriesPerRequest: null es requerido por BullMQ para sus propias conexiones;
// esta instancia de caché general no lo necesita pero mantenerlo igual evita sorpresas.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Redis error:", err.message);
});
