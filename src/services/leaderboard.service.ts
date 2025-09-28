import { prisma } from '../db';
import type { Scope } from '../utils/time';
import { getRangeForScope } from '../utils/time';
import { createHash } from 'crypto';

/** Row returned to frontend */
export type RankRow = {
  rank: number;
  userId: number;
  name: string;
  steps: number;
  avatar?: string | null;
};

function calcIntegrityHash(contestId: number, finalizedAt: Date, topJson: string) {
  return createHash('sha256')
    .update(`${contestId}|${finalizedAt.toISOString()}|${topJson}`)
    .digest('hex');
}

/* -------------------- Contest leaderboard (by contestId) -------------------- */

export async function getLeaderboardPage(
  scope: Scope,
  contestId: number,
  page = 1,
  size = 30
) {
  const skip = (page - 1) * size;
  
  // const contest = await prisma.contest.findFirst({
  //   where: { id: contestId }
  // });
  // const { start, end } = getRangeForScope(scope);
  
  const entries = await prisma.contestEntry.findMany({
    where: { contestId },
    include: { 
      user: { 
        select: { id: true, wechatNick: true, avatarUrl: true } 
      } 
    },
    orderBy: { steps: 'desc' },
    skip,
    take: size + 1,
  });
  
  console.log("entries");
  console.log(entries);
  

  const hasMore = entries.length > size;
  const slice = entries.slice(0, size);
  const userIds = slice.map(g => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, wechatNick: true, avatarUrl: true },
  });
  const uMap = new Map(users.map(u => [u.id, u]));

  const list: RankRow[] = slice.map((e, i) => {
    const u = uMap.get(e.userId);
    const steps = e.steps || 0;

    return {
      rank: skip + i + 1,
      userId: e.userId,
      name: e.user.wechatNick || `用户${e.user.id}`,
      steps: e.steps,
      avatar: e.user.avatarUrl,
    };
  });

  console.log(list);

  return { list, hasMore };
}

export async function getMyRank(
  scope: Scope,
  contestId: number,
  userId: number
): Promise<{ rank: number; steps: number; name: string; avatar?: string | null } | null> {
  const { start, end } = getRangeForScope(scope);

  // const entries = await prisma.contestEntry.findMany({
  //   where: { submittedAt: { gte: start, lte: end }, contestId },
  //   include: { user: { select: { wechatNick: true, avatarUrl: true } } },
  //   orderBy: { steps: 'desc' },
  // });

  const entries = await prisma.contestEntry.findMany({
    where: { contestId, verified: true },
    select: {
      userId: true, steps: true,
      user: { select: { wechatNick: true, avatarUrl: true } }
    },
    orderBy: [{ steps: 'desc' }, { submittedAt: 'asc' }]
  });

  const idx = entries.findIndex(e => e.userId === userId);
  if (idx === -1) return null;

  const me = entries[idx];
  return {
    rank: idx + 1,
    steps: me.steps || 0,
    name: me.user.wechatNick || '我',
    avatar: me.user.avatarUrl,
  };
}

export async function getSnapshot(
  contestId: number,
  userId?: number
): Promise<{ myRank?: number; mySteps?: number; tail5: RankRow[] }> {
  const lb = await prisma.leaderboard.findUnique({ where: { contestId } });

  // compute my rank live
  let myRank: number | undefined;
  let mySteps: number | undefined;

  if (typeof userId === 'number' && Number.isFinite(userId)) {
    const entries = await prisma.contestEntry.findMany({
      where: { contestId, verified: true },
      select: { userId: true, steps: true },
      orderBy: [{ steps: 'desc' }, {submittedAt: 'asc'}]
    });
    const idx = entries.findIndex(e => e.userId === userId);
    if (idx >= 0) {
      myRank = idx + 1;
      mySteps = entries[idx].steps;
    }
  }

  const parseRows = (json?: string | null): RankRow[] => {
    if (!json) return [];
    try { return JSON.parse(json) as RankRow[]; } catch { return []; }
  };

  // tail5 from snapshot if exists; fallback to live tail
  if (lb?.backupJson) {
    const tail5 = safeParseRows(lb.backupJson);
    return { myRank, mySteps, tail5 };
  } else {
    const entries = await prisma.contestEntry.findMany({
      where: { contestId, verified: true },
      include: { 
        user: { 
          select: { id: true, wechatNick: true, avatarUrl: true } 
        } 
      },
      orderBy: [{ steps: 'desc' }, { submittedAt: 'asc' }],
    });
    const tail5Raw = entries.slice(-5);
    const baseRank = entries.length - tail5Raw.length + 1;
    const tail5: RankRow[] = tail5Raw.map((e, i) => ({
      rank: baseRank + i,
      userId: e.userId,
      name: e.user.wechatNick || `用户${e.user.id}`,
      steps: e.steps,
      avatar: e.user.avatarUrl,
    }));
    return { myRank, mySteps, tail5 };
  }
}

/** FINALIZE one contest → write snapshot topJson/tail5 */
export async function finalize(contestId: number) {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) throw new Error('contest_not_found');

  const now = new Date();
  if (contest.endAt > now) {
    return { ok: false as const, reason: 'contest_not_ended' as const };
  }

  const entries = await prisma.contestEntry.findMany({
    where: { contestId, verified: true },
    include: { user: { select: { id: true, wechatNick: true, avatarUrl: true } } },
    orderBy: [{ steps: 'desc' }, { submittedAt: 'asc' }]
  });

  const rewardTopN = contest.rewardTopN ?? 10;
  const topN = entries.slice(0, rewardTopN).map((e, i) => toRankRow(e, i + 1));
  const tail5Raw = entries.slice(-5);
  const baseTailRank = entries.length - tail5Raw.length + 1;
  const tail5 = tail5Raw.map((e, i) => toRankRow(e, baseTailRank + i));

  const finalizedAt = new Date();
  const topJson = JSON.stringify(topN);
  const backupJson = JSON.stringify(tail5);
  const integrityHash = calcIntegrityHash(contestId, finalizedAt, topJson);

  await prisma.leaderboard.upsert({
    where: { contestId },
    update: {
      finalizedAt: finalizedAt,
      topJson: topJson,
      backupJson: backupJson,
      integrityHash: integrityHash,
    },
    create: {
      contest: { connect: { id: contestId } },
      finalizedAt: finalizedAt,
      topJson: topJson,
      backupJson: backupJson,
      integrityHash: integrityHash,
    },
  });

  return { ok: true as const, topCount: topN.length, tailCount: tail5.length };
}

export async function finalizeAllEligible() {
  const now = new Date();
  const ended = await prisma.contest.findMany({
    where: { endAt: { lt: now } },
    select: { id: true },
  });

  const results: Array<{ contestId: number; ok: boolean; reason?: string }> = [];
  for (const c of ended) {
    try {
      const r = await finalize(c.id);
      results.push({ contestId: c.id, ok: !!r.ok, reason: (r as any).reason });
    } catch (e: any) {
      results.push({ contestId: c.id, ok: false, reason: e?.message || 'error' });
    }
  }
  return results;
}

/* --------------------------- helpers --------------------------- */

function toRankRow(
  e: {
    userId: number;
    steps: number;
    user: { id: number; wechatNick: string | null; avatarUrl: string | null };
  },
  rank: number
): RankRow {
  return {
    rank,
    userId: e.userId,
    name: e.user.wechatNick || `用户${e.user.id}`,
    steps: e.steps,
    avatar: e.user.avatarUrl,
  };
}

function safeParseRows(json: string | null | undefined): RankRow[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as RankRow[]) : [];
  } catch {
    return [];
  }
}