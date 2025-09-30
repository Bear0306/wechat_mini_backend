"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addReferral = addReferral;
exports.getReferralMultiplier = getReferralMultiplier;
exports.grantReferralIfEligible = grantReferralIfEligible;
const db_1 = require("../db");
async function addReferral(referrerIdInput, refereeIdInput) {
    const referrerId = Number(referrerIdInput);
    const refereeId = Number(refereeIdInput);
    if (!Number.isFinite(referrerId) || !Number.isFinite(refereeId)) {
        throw new Error('Invalid referrerId/refereeId');
    }
    if (referrerId === refereeId)
        return;
    try {
        await db_1.prisma.referral.create({
            data: { referrerId, refereeId },
        });
    }
    catch (e) {
        if (e?.code === 'P2002')
            return;
        throw e;
    }
}
async function getReferralMultiplier(userIdInput) {
    const userId = Number(userIdInput);
    if (!Number.isFinite(userId)) {
        throw new Error('Invalid userId');
    }
    const referredCount = await db_1.prisma.referral.count({
        where: { referrerId: userId },
    });
    let multiplierX = 1;
    if (referredCount >= 6)
        multiplierX = 3;
    else if (referredCount >= 3)
        multiplierX = 2;
    return { multiplierX, referredCount };
}
async function grantReferralIfEligible(referrerId) {
    const count = await db_1.prisma.referral.count({ where: { referrerId } });
    // 每凑满 3 人送一次
    const packsGiven = Math.floor(count / 3);
    // 查已送了多少次（用一张发放记录表也行；这里直接统计 DoubleCredit + EntryCredit 来推断）
    const givenEntry = await db_1.prisma.entryCredit.count({ where: { userId: referrerId, source: 'REFERRAL' } });
    const givenDouble = await db_1.prisma.doubleCredit.count({ where: { userId: referrerId, source: 'REFERRAL' } });
    // 若已有发放不等于应发放，补发缺口
    const need = Math.max(0, packsGiven - Math.min(givenEntry, givenDouble));
    if (need > 0) {
        await db_1.prisma.$transaction([
            db_1.prisma.entryCredit.create({ data: { userId: referrerId, source: 'REFERRAL', qty: need } }),
            db_1.prisma.doubleCredit.create({ data: { userId: referrerId, source: 'REFERRAL', qty: need } }),
        ]);
    }
}
