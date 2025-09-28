import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../middlewares/auth';
import { prisma } from '../db';

import { addReferral, getReferralMultiplier, grantReferralIfEligible } from '../services/referral.service';

const router=Router();

router.post('/bind', auth, async(req: any, res) => {
    // const body = z.object({referrerId: z.string()}).parse(req.body);
    
    // await addReferral(body.referrerId, req.user!.uid);
    
    // const multi = await getReferralMultiplier(body.referrerId);
    // res.json({ok: true, referrerMultiplier: multi});
    const uid = Number(req.user?.uid ?? 5);             // 新用户
    const { referrerId } = req.body;

    if (!referrerId || referrerId === uid) return res.status(400).json({ message: '参数错误' });

    // 避免重复绑定
    const exists = await prisma.referral.findFirst({ where: { refereeId: uid }});
    if (!exists) {
        await prisma.referral.create({ data: { referrerId, refereeId: uid }});
        await grantReferralIfEligible(referrerId);
    }
    res.json({ ok: true });
});

router.get('/multiplier', auth, async(req: any, res) => {
    const multi = await getReferralMultiplier(req.user!.uid);
    res.json({multiplierX: multi});
});

export default router;