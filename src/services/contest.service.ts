import { prisma } from '../db';
import { ContestFreq, ContestScope, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getOrCreateContest(city: string, heatLevel: number) {
  // Use Prisma enum values, not bare strings
  const frequency: ContestFreq =
    heatLevel >= 4 ? ContestFreq.DAILY : ContestFreq.WEEKLY;

  const now = DateTime.now();

  // Force proper typing to Date to avoid `any`
  const startAt: Date = (
    frequency === ContestFreq.DAILY ? now.startOf('day') : now.startOf('week')
  ).toJSDate();

  const endAt: Date = (
    frequency === ContestFreq.DAILY ? now.endOf('day') : now.endOf('week')
  ).toJSDate();

  const existing = await prisma.contest.findFirst({
    where: {
      scope: ContestScope.CITY,
      regionCode: city,
      startAt: { lte: now.toJSDate() },
      endAt: { gte: now.toJSDate() },
      frequency, // optional, but keeps it consistent with create
    },
  });

  if (existing) return existing;

  // Build a data object that *satisfies* the expected Prisma type
  const data: Prisma.ContestCreateInput = {
    scope: ContestScope.CITY,
    regionCode: city,
    heatLevel,
    frequency,
    prizeMin: heatLevel >= 4 ? 100 : 50,
    prizeMax: heatLevel >= 4 ? 500 : 200,
    startAt,
    endAt,
  };

  return prisma.contest.create({ data });
}
