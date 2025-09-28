// import { Router } from 'express';
// import { z } from 'zod';
// import { auth } from '../middlewares/auth';
// import { isWithinValidCollectWindow } from '../utils/time';
// import { prisma } from '../db';
// import { decryptWeRun } from '../adapters/wechat';
// import { requestLivenessCheck } from '../adapters/liveness';
// import { getReferralMultiplier } from '../services/referral.service';
// import { getOrCreateContest } from '../services/contest.service';

// const router=Router();

// router.get('/recent_list', auth, async(req: any, res) => {

// });

// router.post('/participate', auth, async(req: any, res) => {
//     if(!isWithinValidCollectWindow())
//         return res.status(400).json({message: '仅统计06:00-20:00数据'});
    
//     const body = z.object({
//         encryptedData: z.string(), 
//         iv: z.string(),
//         sessionKey: z.string(),
//         lat: z.number().optional(),
//         lng: z.number().optional()
//     }).parse(req.body);
    
//     const run = decryptWeRun(body.encryptedData, body.sessionKey, body.iv) as { 
//         stepInfoList:{ timestamp: number, step: number }[] 
//     };
    
//     const today = run.stepInfoList.sort((a, b) => b.timestamp - a.timestamp)[0]?.step || 0;
//     const user = await prisma.user.findUnique({where: {id: req.user!.uid}});
    
//     if(!user)
//         return res.status(404).json({message: '用户不存在'});
    
//     if(!user.canParticipate)
//         return res.status(403).json({message: '年龄段限制不可参赛'});
    
//     const city = user.city || '默认城市';
//     const heatLevel = 4;
//     const contest = await getOrCreateContest(city, heatLevel);
//     let livenessOk = false;
    
//     if(process.env.ENABLE_LIVENESS !== 'false') {
//         livenessOk = await requestLivenessCheck(user.id);
//     }
    
//     const multiplierX = await getReferralMultiplier(user.id);
//     const isMinor = user.ageGroup === 'MINOR_12_18';
//     const entry = await prisma.contestEntry.create({
//         data: {
//             userId: user.id,
//             contestId: contest.id,
//             steps: today,
//             distanceM: Math.floor(today*0.6),
//             verified: true,
//             livenessOk,
//             multiplierX,
//             isMinor
//         }
//     });
    
//     res.json({contestId: contest.id, entryId: entry.id, steps: today, multiplierX});
// });

// export default router;

import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { ContestStatus, DataProvider } from '@prisma/client';
import { startOfToday, formatCnRange } from '../utils/time';

const router = Router();

/** List contests (sorted by end date) */
router.get('/recent-list', async (req, res) => {
  const contests = await prisma.contest.findMany({
    orderBy: {
      startAt: 'desc',
    },
    take: 3,
  });

  res.json({ items: contests });
});

router.get('/list', async (req, res) => {
  const contests = await prisma.contest.findMany({
    orderBy: { endAt: 'asc' }
  });

  res.json({ items: contests });
});

/** Participate in a contest */
router.post('/participate', async (req, res) => {
  // const uid = Number(req.user?.uid ?? 5); // 本地联调用固定用户

  const uid = 5;
  const body = z.object({
    contestId: z.coerce.number().int().positive(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ message: '参数错误' });

  const contest = await prisma.contest.findUnique({
    where: { id: body.data.contestId },
    select: { id: true, startAt: true, endAt: true, status: true },
  });
  if (!contest) return res.status(404).json({ message: '赛事不存在' });

  const now = new Date();

  // 仅允许“未开始”报名：UI 对应“未开始=显示 参与挑战”
  const notStartedYet = now < contest.startAt;
  if (!notStartedYet) {
    if (now > contest.endAt || contest.status === ContestStatus.FINALIZED) {
      return res.status(409).json({ code: 'contest_ended', message: '赛事已结束，仅可查看排名' });
    }
    return res.status(409).json({ code: 'contest_started', message: '赛事已开始，仅可查看排名' });
  }

  // 报名（若已存在则复用）
  const entry = await prisma.contestEntry.upsert({
    where: { userId_contestId: { userId: uid, contestId: contest.id } },
    update: {}, // 已报名则不改动（也可重置 steps=0 看你需求）
    create: {
      userId: uid,
      contestId: contest.id,
      steps: 0,
      distanceM: 0,
      provider: DataProvider.OTHER,
      verified: false,
      status: 'PENDING',
      submittedAt: now,
    },
    select: { id: true, contestId: true },
  });

  return res.json({ ok: true, entryId: entry.id, contestId: entry.contestId });
});

router.get('/ended', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const size = Number(req.query.size ?? 10);

  const q = z.object({
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(50).default(10)
  }).parse(req.query);

  // const uid  = req.user!.uid;
  const uid = 5;

  const today0 = startOfToday();

  // participated contest ids
  const participatedIds = (await prisma.contestEntry.findMany({
    where: { userId: uid, verified: true },
    select: { contestId: true },
    distinct: ['contestId']
  })).map(x => x.contestId);

  // 结束赛事（昨天及以前）
  const ended = await prisma.contest.findMany({
    where: { endAt: { lt: today0 } },
    orderBy: { endAt: 'desc' },
    select: { id: true, title: true, startAt: true, endAt: true, rewardTopN: true }
  });

  // 装饰
  const itemsAll = await Promise.all(ended.map(async c => {
    const my = await prisma.contestEntry.findFirst({
      where: { contestId: c.id, userId: uid, verified: true },
      select: { steps: true }
    });

    let myRank: number | null = null;
    let canClaim = false;
    let claimed = false;

    if (my) {
      const better = await prisma.contestEntry.count({
        where: { contestId: c.id, verified: true, steps: { gt: my.steps } }
      });
      myRank = better + 1;
      canClaim = myRank <= c.rewardTopN;

      const pc = await prisma.contestPrizeClaim.findFirst({
        where: { contestId: c.id, userId: uid }
      });
      claimed = !!pc;
      if (claimed) canClaim = false;
    }

    return {
      contestId: c.id,
      title: c.title,
      dateText: formatCnRange(c.startAt, c.endAt),
      rewardTopN: c.rewardTopN,
      myRank, canClaim, claimed
    };
  }));

  const lists = itemsAll.sort((a, b) => {
    const aIn = participatedIds.includes(a.contestId) ? 1 : 0;
    const bIn = participatedIds.includes(b.contestId) ? 1 : 0;
    if (aIn !== bIn) return bIn - aIn;
    return 0;
  });

  const start = (q.page - 1) * q.size;
  const pageItems = lists.slice(start, start + q.size);
  res.json({ items: pageItems, hasMore: start + q.size < lists.length });

  // const total = await prisma.contest.count({
  //   where: {
  //     endAt: { lt: new Date() },               // or: status: 'FINALIZED'
  //     entries: { some: { userId: Number(uid) } }
  //   }
  // });

  // // query ended contests
  // const contests = await prisma.contest.findMany({
  //   where: {
  //     endAt: { lt: new Date() },               // or: status: 'FINALIZED'
  //     entries: { some: { userId: Number(uid) } }
  //   },
  //   orderBy: { endAt: 'desc' },
  //   skip: (page - 1) * size,
  //   take: size,
  //   select: {
  //     id: true,
  //     title: true,
  //     startAt: true,
  //     endAt: true,
  //     rewardTopN: true,
  //     frequency: true
  //   }
  // });

  // // Decorate each contest with myRank/canClaim/claimed/dateText
  // const items = await Promise.all(
  //   contests.map(async (c) => {
  //     const my = await prisma.contestEntry.findFirst({
  //       where: { contestId: c.id, userId: Number(uid), verified: true },
  //       select: { steps: true }
  //     });

  //     let myRank: number | null = null;
  //     let canClaim = false;
  //     let claimed = false;
  //     let claimId = null;

  //     if (my) {
  //       const better = await prisma.contestEntry.count({
  //         where: { contestId: c.id, verified: true, steps: { gt: my.steps } }
  //       });
  //       myRank = better + 1;
  //       canClaim = myRank <= c.rewardTopN;

  //       const pc = await prisma.contestPrizeClaim.findUnique({
  //         // composite unique on (contestId,userId) recommended
  //         where: { contestId_userId: { contestId: c.id, userId: Number(uid) } } as any,
  //         select: {id: true}
  //       });
  //       claimed = !!pc;
  //       claimId = pc?.id || null;
  //       if (claimed) canClaim = false;
  //     }

  //     const sSame = c.startAt.toDateString() === c.endAt.toDateString();
  //     const sMonth = c.startAt.getMonth() + 1;
  //     const sDate = c.startAt.getDate();
  //     const s = sMonth + "月" + sDate + "日";
  //     const eMonth = c.endAt.getMonth() + 1;
  //     const eDate = c.endAt.getDate();
  //     const e = eMonth + "月" + eDate + "日";
  //     const dateText = sSame ? s : `${s} - ${e}`;

  //     return {
  //       contestId: c.id,
  //       title: c.title,
  //       dateText,
  //       rewardTopN: c.rewardTopN,
  //       myRank,
  //       canClaim,
  //       claimed,
  //       claimId: claimId
  //     };
  //   })
  // );

  // res.json({
  //   items,
  //   hasMore: page * size < total
  // });
});

export default router;