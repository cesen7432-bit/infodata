import IORedis from "ioredis";
import { env } from "../config/env";

// BullMQ exige su propia conexión con maxRetriesPerRequest: null.
export const queueConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
