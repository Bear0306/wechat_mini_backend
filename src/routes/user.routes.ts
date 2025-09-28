import { Router } from 'express';
import { z } from 'zod';
import { auth, AuthedRequest } from '../middlewares/auth';
import { updateUserProfile } from '../services/user.service';
import { reverseGeocodeCity } from '../adapters/maps';
import { cityOnlyName } from '../utils/location';
import { prisma } from '../db';
import dayjs from 'dayjs';

const router = Router();

function sumAvail(items: { qty: number; consumedQty: number; expiresAt: Date | null }[]) {
  const now = new Date();
  return items.reduce((acc, it) => {
    if (it.expiresAt && it.expiresAt < now) return acc;
    return acc + Math.max(0, it.qty - it.consumedQty);
  }, 0);
}

function getThisWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // JS: 0=Sun..6=Sat → days since Monday:
  const daysFromMon = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMon);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

router.post('/profile', auth, async (req: AuthedRequest, res) => {
  const body = z.object({
    phone: z.string().optional(),
    realNameVerified: z.boolean().optional(),
    birthday: z.string().datetime().optional(), // ISO datetime string
    lat: z.number().optional(),
    lng: z.number().optional(),
    wechatNick: z.string().optional(),
    avatarUrl: z.string().url().optional(),
  }).parse(req.body);

  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  let city: string | undefined;
  if (typeof body.lat === 'number' && typeof body.lng === 'number') {
    const gc = await reverseGeocodeCity(body.lat, body.lng);
    city = cityOnlyName(gc);
  }

  const profile = await updateUserProfile(req.userId, {
    phone: body.phone,
    wechatNick: body.wechatNick,
    avatarUrl: body.avatarUrl,
    realNameVerified: body.realNameVerified,
    birthDate: body.birthday ? new Date(body.birthday) : undefined,
    city,
  });

  res.json({ profile });
});

router.get('/me',async (req: any, res) => {
  // const uid = req.user!.uid;
  const uid = Number(req.user?.uid ?? 5);

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, wechatNick: true }
  });
  if (!user) return res.status(404).json({ message: '用户不存在' });

  // 本周步数（用本周的参赛记录步数之和，已校验通过）
  const { start, end } = getThisWeekRange();
  const entries = await prisma.contestEntry.findMany({
    where: {
      userId: uid,
      verified: true,
      submittedAt: { gte: start, lt: end }
    },
    select: { steps: true }
  });
  const weekSteps = entries.reduce((sum, e) => sum + (e.steps || 0), 0);

  // 可挑战次数：所有有效 EntryCredit 的可用余量之和
  const now = new Date();
  const credits = await prisma.entryCredit.findMany({
    where: {
      userId: uid,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: { qty: true, consumedQty: true }
  });
  const joinCount = credits.reduce(
    (sum, c) => sum + Math.max(0, (c.qty ?? 0) - (c.consumedQty ?? 0)),
    0
  );

  res.json({
    uid: user.id,
    nickname: user.wechatNick || '我的昵称',
    weekSteps,
    joinCount
  });
}); 

router.get('/me/stats', /*auth,*/ async (req: any, res) => {
  const uid = Number(req.user?.uid ?? 5);

  const [entryCredits, doubleCredits, membership, referrals, todayAds] = await Promise.all([
    prisma.entryCredit.findMany({ where: { userId: uid }, select: { qty: true, consumedQty: true, expiresAt: true }}),
    prisma.doubleCredit.findMany({ where: { userId: uid }, select: { qty: true, consumedQty: true, expiresAt: true }}),
    prisma.membership.findUnique({ where: { userId: uid }}),
    prisma.referral.count({ where: { referrerId: uid }}),
    prisma.adReward.findMany({
      where: {
        userId: uid,
        watchedAt: { gte: dayjs().startOf('day').toDate() }
      },
      select: { id: true, granted: true }
    }),
  ]);

  const joinCount = sumAvail(entryCredits);
  const doubleCount = sumAvail(doubleCredits);

  // 激励广告：统计“今天已观看/已记奖”的进度
  const watched = todayAds.length;
  const grantedCount = todayAds.filter(a => a.granted).length; // 只是示例
  // 简单进度：每满 3 次 +1；显示下一个奖励还差几次
  const toNext = (3 - (watched % 3)) % 3;

  res.json({
    joinCount,                 // 可挑战次数
    doubleCount,               // 奖励翻倍次数
    referrals: {
      successCount: referrals, // 推荐成功人数
      // 你也可以返回“此推荐累计送的次数/翻倍”，方便前端展示
    },
    ads: { watched, toNext },  // 今日广告进度
    membership: membership ? { tier: membership.tier, endAt: membership.endAt } : null,
  });
});

export default router;
