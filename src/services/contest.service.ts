import { prisma } from '../db';
import { ContestFreq, ContestScope, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getOrCreateContest(cityCode: string, heatLevel: number) {
  const frequency: ContestFreq =
    heatLevel >= 4 ? ContestFreq.DAILY : ContestFreq.WEEKLY;

  const now = DateTime.now();
  const startLux = frequency === ContestFreq.DAILY ? now.startOf('day') : now.startOf('week');
  const endLux   = frequency === ContestFreq.DAILY ? now.endOf('day')   : now.endOf('week');
  const startAt: Date = startLux.toJSDate();
  const endAt: Date = endLux.toJSDate();

  // You may filter by FK scalar in where:
  const existing = await prisma.contest.findFirst({
    where: {
      scope: ContestScope.CITY,
      regionCode: cityCode,
      frequency,
      startAt: { lte: now.toJSDate() },
      endAt:   { gte: now.toJSDate() },
    },
  });
  if (existing) return existing;

  const title = `${cityCode} ${frequency === ContestFreq.DAILY ? 'Daily' : 'Weekly'} ${startLux.toISODate()}`;

  return prisma.contest.create({
    data: {
      title,
      scope: ContestScope.CITY,
      heatLevel,
      frequency,
      prizeMin: heatLevel >= 4 ? 100 : 50,
      prizeMax: heatLevel >= 4 ? 500 : 200,
      startAt,
      endAt,
      // 👇 must set the relation (checked create hides regionCode)
      region: { connect: { code: cityCode } },
    } satisfies Prisma.ContestCreateInput,
  });
}