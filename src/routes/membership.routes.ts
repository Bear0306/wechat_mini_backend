// import { Router } from 'express';
// import { z } from 'zod';
// import { auth } from '../middlewares/auth';
// import { upsertMembership } from '../services/membership.service';
// import { MembershipTier } from '@prisma/client';

// const router=Router();

// router.post('/purchase', auth, async(req: any, res) => {
//     const body = z.object({
//         tier: z.enum(['VIP', 'VIP_PLUS']),
//         months: z.number().int().min(1).max(12).default(1)
//     }).parse(req.body);
    
//     const m = await upsertMembership(req.user!.uid, body.tier as MembershipTier, body.months);
    
//     res.json({membership: m});
// });

// export default router;

import { Router } from 'express';
import { prisma } from '../db';
import { MembershipTier } from '@prisma/client';
import dayjs from 'dayjs';

const router = Router();

const PLANS = [
  // SILVER / 月
  { id:'SILVER_M', tier:'SILVER', period:'MONTH', price: 990,  monthlyCredits:4,  carryOver:true,  adFree:true, allowRegionSelect:false, autoJoin:false, displayName:'白银会员(月)' },
  // SILVER / 年
  { id:'SILVER_Y', tier:'SILVER', period:'YEAR',  price: 6990, monthlyCredits:4,  carryOver:true,  adFree:true, allowRegionSelect:false, autoJoin:false, displayName:'白银会员(年)' },
  // GOLD / 月 (按照你的图：199.9 与描述 30 或 20 次二选一，我按图：199.9/月→20 次)
  { id:'GOLD_M', tier:'GOLD',   period:'MONTH', price:19990, monthlyCredits:20, carryOver:true,  adFree:true, allowRegionSelect:true,  autoJoin:true, displayName:'黄金会员(月)' },
  // GOLD / 年
  { id:'GOLD_Y', tier:'GOLD',   period:'YEAR',  price:19990, monthlyCredits:30, carryOver:true,  adFree:true, allowRegionSelect:true,  autoJoin:true, displayName:'黄金会员(年)' },
] as const;

function normalizeTier(dbTier?: string | null):
  'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' {
  if (!dbTier || dbTier === 'NONE') return 'NONE';
  // support both old (VIP/VIP_PLUS) and new (BRONZE/SILVER/GOLD) enums
  switch (dbTier) {
    case 'BRONZE': return 'BRONZE';
    case 'SILVER': return 'SILVER';
    case 'GOLD':   return 'GOLD';
    case 'VIP':        return 'SILVER';
    case 'VIP_PLUS':   return 'GOLD';
    default: return 'NONE';
  }
}

router.post('/purchase', async (req, res) => {
  // const { userId, tier, months } = req.body;
  // const uid = Number(req.user?.uid ?? 5);
  // const { tier } = req.body;

  // if (!userId || !tier) return res.status(400).json({ error: 'params missing' });

  // const start = new Date();
  // const end = new Date();
  // end.setMonth(end.getMonth() + (months || 1));

  // const membership = await prisma.membership.upsert({
  //   where: { userId },
  //   update: { tier, startAt: start, endAt: end },
  //   create: {
  //     userId,
  //     tier,
  //     startAt: start,
  //     endAt: end,
  //     monthlyQuota: tier === MembershipTier.VIP ? 30 : 60,
  //     carryOver: 0,
  //     autoJoin: tier === MembershipTier.VIP_PLUS
  //   }
  // });

  // res.json({ membership });
  // const uid = Number(req.user?.uid ?? 5);
  const uid = 5;
  const { tier } = req.body; // 'VIP' | 'VIP_PLUS'

  const now = new Date();
  const end = dayjs(now).add(1, 'month').toDate();
  const qty = tier === 'VIP_PLUS' ? 20 : 4;

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId: uid },
      update: { tier, startAt: now, endAt: end, monthlyQuota: qty },
      create: { userId: uid, tier, startAt: now, endAt: end, monthlyQuota: qty, carryOver: 0 }
    }),
    prisma.entryCredit.create({ data: { userId: uid, source: 'MEMBERSHIP', qty }})
  ]);

  res.json({ ok: true, tier, qtyGranted: qty });
});

router.get('/me', async (req: any, res) => {
  const uid = Number(req.user?.uid ?? 5);

  const m = await prisma.membership.findUnique({
    where: { userId: uid },
    select: { tier: true, startAt: true, endAt: true, autoJoin: true },
  });

  // map DB enum -> UI names expected by the mini-program
  // NONE -> BRONZE (free), VIP -> SILVER, VIP_PLUS -> GOLD
  const uiTier =
    m?.tier === MembershipTier.VIP_PLUS
      ? 'GOLD'
      : m?.tier === MembershipTier.VIP
      ? 'SILVER'
      : 'BRONZE';

  // capabilities
  const adFree = m?.tier === MembershipTier.VIP || m?.tier === MembershipTier.VIP_PLUS;
  const allowRegionSelect = m?.tier === MembershipTier.VIP_PLUS;

  // remaining joins from EntryCredit
  const credits = await prisma.entryCredit.findMany({
    where: { userId: uid },
    select: { qty: true, consumedQty: true, expiresAt: true },
  });
  const joinCount = credits.reduce((acc, c) => acc + Math.max(0, c.qty - c.consumedQty), 0);

  res.json({
    tier: uiTier,                 // "BRONZE" | "SILVER" | "GOLD"
    startAt: m?.startAt ?? null,
    endAt: m?.endAt ?? null,
    adFree,
    allowRegionSelect,
    autoJoin: !!m?.autoJoin,
    joinCount,
  });
});

router.get('/products', (_req,res)=> {
  res.json(PLANS);
});

export default router;
