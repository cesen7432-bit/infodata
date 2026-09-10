import { prisma } from "../db/prisma";

export async function recordSearch(userId: string, identification: string, personFound: boolean): Promise<void> {
  await prisma.searchHistory.upsert({
    where: { userId_identification: { userId, identification } },
    create: { userId, identification, personFound, lastSearchedAt: new Date() },
    update: { personFound, lastSearchedAt: new Date() },
  });
}

export async function getRecentSearches(userId: string, limit = 10) {
  return prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { lastSearchedAt: "desc" },
    take: limit,
    select: { identification: true, personFound: true, lastSearchedAt: true },
  });
}
