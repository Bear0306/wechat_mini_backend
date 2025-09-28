/* prisma/seed.ts */
import {
  PrismaClient,
  AgeGroup,
  MembershipTier,
  ContestScope,
  ContestFreq,
  ContestAudience,
  ContestStatus,
  RegionLevel,
  EntryStatus,
  DataProvider,
  PrizeClaimStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

function at(dOffset: number, h: number, m = 0, s = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dOffset);
  d.setHours(h, m, s, 0);
  return d;
}
function statusForRange(startAt: Date, endAt: Date): ContestStatus {
  const now = new Date();
  if (now < startAt) return ContestStatus.SCHEDULED;
  if (now > endAt) return ContestStatus.FINALIZED;
  return ContestStatus.ACTIVE;
}

async function main() {
  console.log('Seeding…');

  // ---------- clean (dev only) ----------
  await prisma.$transaction([
    prisma.apiCallLog.deleteMany(),
    prisma.apiProvider.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.contestPrizeClaim.deleteMany(),
    prisma.leaderboard.deleteMany(),
    prisma.contestEntry.deleteMany(),
    prisma.membershipHistory.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.adReward.deleteMany(),
    prisma.entryCredit.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.contest.deleteMany(),
    prisma.prize.deleteMany(),
    prisma.region.deleteMany(),
    prisma.userConsent.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ---------- regions ----------
  // PROVINCE: CN-11 北京市；CITY: CN-11-01 北京市；DISTRICT: CN-11-01-01 东城区
  await prisma.region.createMany({
    data: [
      { code: 'CN-11', name: '北京市', level: RegionLevel.PROVINCE, parent: null },
      { code: 'CN-11-01', name: '北京市', level: RegionLevel.CITY, parent: 'CN-11' },
      { code: 'CN-11-01-01', name: '东城区', level: RegionLevel.DISTRICT, parent: 'CN-11-01' },
    ],
    skipDuplicates: true,
  });

  // ---------- prizes ----------
  const situp = await prisma.prize.create({
    data: { title: '仰卧起坐辅助器', valueCents: 3599, category: 'GEAR', isMinorSafe: true },
  });
  const book = await prisma.prize.create({
    data: { title: '运动解剖学（书籍）', valueCents: 2999, category: 'BOOKS', isMinorSafe: true },
  });

  // ---------- app settings / providers ----------
  await prisma.appSetting.create({
    data: {
      key: 'app.config',
      valueJson: JSON.stringify({
        statsWindow: { start: '06:00', end: '20:00' },
        minorPrizeCap: 3000,
      }),
    },
  });
  await prisma.apiProvider.createMany({
    data: [
      { name: 'WECHAT_SPORTS', isoCert: 'ISO 27001', slaUrl: '' },
      { name: 'NANO', isoCert: 'ISO 27001', slaUrl: '' },
    ],
  });

  // ---------- users ----------
  const users = [];
  for (let i = 1; i <= 20; i++) {
    const age = i < 5 ? 14 + i : (i > 17 ? 61 + (i - 17) : 21 + i);
    const ag: AgeGroup =
      age < 12
        ? 'BLOCKED_UNDER_12'
        : age <= 18
        ? 'MINOR_12_18'
        : age <= 65
        ? 'ADULT'
        : 'SENIOR_65_PLUS';
    const u = await prisma.user.create({
      data: {
        openid: `openid_${i}`,
        unionid: null,
        phoneEnc: `enc_${i}`,
        wechatNick: `用户${i}`,
        realNameVerified: i % 2 === 0,
        birthDate: at(-365 * age, 0),
        age,
        ageGroup: ag,
        canParticipate: ag !== 'BLOCKED_UNDER_12' && ag !== 'SENIOR_65_PLUS',
        canBuyMembership: ag === 'ADULT',
        city: '北京市',
      },
    });
    users.push(u);
  }

  // membership for uid=5 (users[4])
  await prisma.membership.create({
    data: {
      userId: users[4].id,
      tier: MembershipTier.VIP,
      startAt: at(-10, 0),
      endAt: at(20, 0),
      monthlyQuota: 20,
      carryOver: 5,
      autoJoin: true,
    },
  });

  // ---------- contests ----------
  const makeContest = async (
    title: string,
    startAt: Date,
    endAt: Date,
    freq: ContestFreq,
    audience: ContestAudience = ContestAudience.ADULTS
  ) =>
    prisma.contest.create({
      data: {
        title,
        scope: ContestScope.CITY,
        regionCode: 'CN-11-01',
        heatLevel: 5,
        frequency: freq,
        audience,
        status: statusForRange(startAt, endAt),
        rewardTopN: freq === 'WEEKLY' ? 20 : 10,
        prizeMin: 50,
        prizeMax: 200,
        startAt,
        endAt,
      },
    });

  // ended daily (yesterday)
  const cDaily1 = await makeContest('＊日赛 1', at(-1, 6), at(-1, 20), ContestFreq.DAILY);
  // ended daily (2 days ago)
  const cDaily2 = await makeContest('＊日赛 2', at(-2, 6), at(-2, 20), ContestFreq.DAILY);
  // ended weekly (last week Mon 6:00 to Sun 20:00)
  const today = new Date();
  const dow = today.getDay() || 7; // Mon=1..Sun=7
  const lastMon6 = at(-(dow + 6), 6);
  const lastSun20 = at(-dow, 20);
  const cWeek1 = await makeContest('＊周赛', lastMon6, lastSun20, ContestFreq.WEEKLY);

  // ongoing daily (today 6–20)
  const cDailyNow = await makeContest('＊日赛（进行中）', at(0, 6), at(0, 20), ContestFreq.DAILY);

  // ---------- entries ----------
  async function seedEntries(contestId: number, biasUserId?: number, biasSteps?: number) {
    for (const u of users) {
      let steps = Math.floor(13000 + Math.random() * 10000); // 13k–23k
      if (biasUserId && u.id === biasUserId && typeof biasSteps === 'number') steps = biasSteps;
      await prisma.contestEntry.create({
        data: {
          userId: u.id,
          contestId,
          steps,
          distanceM: Math.floor(steps * 0.6),
          provider: DataProvider.WECHAT_SPORTS,
          providerRef: null,
          sampleStartAt: (await prisma.contest.findUnique({ where: { id: contestId } }))!.startAt,
          sampleEndAt: (await prisma.contest.findUnique({ where: { id: contestId } }))!.endAt,
          dataHash: null,
          verified: true,
          status: EntryStatus.VERIFIED,
          livenessOk: u.id % 5 !== 0,
          livenessAt: at(0, 12),
          multiplierX: u.id % 7 === 0 ? 2 : 1,
          fundedByCreditId: null,
          notes: null,
        },
      });
    }
  }

  // Make sure uid=5 ranks high in cDaily1 (to show "领取奖励")
  await seedEntries(cDaily1.id, users[4].id, 24000);
  // ensure a higher #1
  await prisma.contestEntry.updateMany({
    where: { contestId: cDaily1.id, userId: users[0].id },
    data: { steps: 25000, distanceM: Math.floor(25000 * 0.6) },
  });

  await seedEntries(cDaily2.id);
  // For weekly, also let uid=5 be in top N and create a claim (so UI shows “查看奖励”)
  await seedEntries(cWeek1.id, users[4].id, 23000);
  await seedEntries(cDailyNow.id);

  // ---------- helper: top ranks ----------
  const topRanks = async (contestId: number, take: number) =>
    prisma.contestEntry.findMany({
      where: { contestId, verified: true },
      select: { userId: true, steps: true },
      orderBy: { steps: 'desc' },
      take,
    });

  const wTop3 = await topRanks(cWeek1.id, 3);

  // Claims for weekly: one shipped, one submitted, one pending
  if (wTop3[0])
    await prisma.contestPrizeClaim.create({
      data: {
        contestId: cWeek1.id,
        userId: wTop3[0].userId,
        prizeId: situp.id,
        rank: 1,
        steps: wTop3[0].steps,
        status: PrizeClaimStatus.SHIPPED,
        waybillNo: 'SF4719755091224633552',
      },
    });
  if (wTop3[1])
    await prisma.contestPrizeClaim.create({
      data: {
        contestId: cWeek1.id,
        userId: wTop3[1].userId,
        prizeId: book.id,
        rank: 2,
        steps: wTop3[1].steps,
        status: PrizeClaimStatus.SUBMITTED,
        orderNo: 'TB202409150001',
        taobaoLink: 'https://tb.example.com/your-link',
      },
    });
  if (wTop3[2])
    await prisma.contestPrizeClaim.create({
      data: {
        contestId: cWeek1.id,
        userId: wTop3[2].userId,
        prizeId: null,
        rank: 3,
        steps: wTop3[2].steps,
        status: PrizeClaimStatus.PENDING_INFO,
      },
    });

  // Ensure uid=5 is within rewardTopN for cDaily1 but has **no** claim yet → “领取奖励”
  const myD1 = await prisma.contestEntry.findFirst({
    where: { contestId: cDaily1.id, userId: users[4].id },
  });
  if (myD1) {
    const better = await prisma.contestEntry.count({
      where: { contestId: cDaily1.id, verified: true, steps: { gt: myD1.steps } },
    });
    const rank = better + 1;
    if (rank > 10) {
      await prisma.contestEntry.update({
        where: { id: myD1.id },
        data: { steps: 22000, distanceM: 13200 },
      });
    }
  }

  console.log('Seed done.');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
