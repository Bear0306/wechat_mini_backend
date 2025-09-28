import { prisma } from '../db';

export async function addReferral(referrerIdInput: number | string, refereeIdInput: number | string) {
    const referrerId = Number(referrerIdInput);
    const refereeId = Number(refereeIdInput);

    if (!Number.isFinite(referrerId) || !Number.isFinite(refereeId)) {
        throw new Error('Invalid referrerId/refereeId');
    }

    if (referrerId === refereeId) return;
    
    try {
        await prisma.referral.create({
            data: { referrerId, refereeId },
        });
    } catch (e: any) {
        if (e?.code === 'P2002') return;

        throw e;
    }
}

export async function getReferralMultiplier(userIdInput: number | string): Promise<{ multiplierX: number; referredCount: number }> {
    const userId = Number(userIdInput);
    
    if (!Number.isFinite(userId)) {
        throw new Error('Invalid userId');
    }

    const referredCount = await prisma.referral.count({
        where: { referrerId: userId },
    });

    let multiplierX = 1;
    if (referredCount >= 6) multiplierX = 3;
    else if (referredCount >= 3) multiplierX = 2;

    return { multiplierX, referredCount };
}

export async function grantReferralIfEligible(referrerId: number) {
    const count = await prisma.referral.count({ where: { referrerId } });
    // 每凑满 3 人送一次
    const packsGiven = Math.floor(count / 3);
  
    // 查已送了多少次（用一张发放记录表也行；这里直接统计 DoubleCredit + EntryCredit 来推断）
    const givenEntry = await prisma.entryCredit.count({ where: { userId: referrerId, source: 'REFERRAL' }});
    const givenDouble = await prisma.doubleCredit.count({ where: { userId: referrerId, source: 'REFERRAL' }});
  
    // 若已有发放不等于应发放，补发缺口
    const need = Math.max(0, packsGiven - Math.min(givenEntry, givenDouble));
    if (need > 0) {
      await prisma.$transaction([
        prisma.entryCredit.create({ data: { userId: referrerId, source: 'REFERRAL', qty: need }}),
        prisma.doubleCredit.create({ data: { userId: referrerId, source: 'REFERRAL', qty: need }}),
      ]);
    }
}