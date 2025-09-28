import { prisma } from '../db';
import { ContestFreq } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getOrCreateContest(city: string, heatLevel: number) {
    const freq: ContestFreq = heatLevel >= 4 ? 'DAILY': 'WEEKLY';
    const now = DateTime.now();
    const startAt = freq === 'DAILY' ? now.startOf('day') : now.startOf('week');
    const endAt = freq === 'DAILY' ? now.endOf('day') : now.endOf('week');
    const existing = await prisma.contest.findFirst({
        where: {
            scope: 'CITY',
            regionCode: city,
            startAt: { lte: now.toJSDate() },
            endAt: { gte: now.toJSDate()}
        }
    });
    
    if (existing) 
        return existing;
    
    return prisma.contest.create({
        data: {
            scope: 'CITY',
            regionCode: city,
            heatLevel,
            frequency: freq,
            prizeMin: heatLevel >= 4 ? 100 : 50,
            prizeMax: heatLevel >= 4 ? 500 : 200,
            startAt: startAt.toJSDate(),
            endAt: endAt.toJSDate()
        }
    });
} 