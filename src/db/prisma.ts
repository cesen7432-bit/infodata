import { PrismaClient } from "@prisma/client";

// Instancia única compartida por toda la API y los workers.
export const prisma = new PrismaClient();
