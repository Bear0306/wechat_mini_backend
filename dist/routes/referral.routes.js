"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const db_1 = require("../db");
const referral_service_1 = require("../services/referral.service");
const router = (0, express_1.Router)();
router.post('/bind', auth_1.auth, async (req, res) => {
    // const body = z.object({referrerId: z.string()}).parse(req.body);
    // await addReferral(body.referrerId, req.user!.uid);
    // const multi = await getReferralMultiplier(body.referrerId);
    // res.json({ok: true, referrerMultiplier: multi});
    const uid = Number(req.user?.uid ?? 5); // 新用户
    const { referrerId } = req.body;
    if (!referrerId || referrerId === uid)
        return res.status(400).json({ message: '参数错误' });
    // 避免重复绑定
    const exists = await db_1.prisma.referral.findFirst({ where: { refereeId: uid } });
    if (!exists) {
        await db_1.prisma.referral.create({ data: { referrerId, refereeId: uid } });
        await (0, referral_service_1.grantReferralIfEligible)(referrerId);
    }
    res.json({ ok: true });
});
router.get('/multiplier', auth_1.auth, async (req, res) => {
    const multi = await (0, referral_service_1.getReferralMultiplier)(req.user.uid);
    res.json({ multiplierX: multi });
});
exports.default = router;
