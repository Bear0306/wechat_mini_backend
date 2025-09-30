"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
// import { pickPrizeForRank } from '../services/prize.service';
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Helper: compute my rank inside a contest
async function computeRank(contestId, userId) {
    const me = await db_1.prisma.contestEntry.findFirst({
        where: { contestId, userId, verified: true },
        select: { steps: true }
    });
    if (!me)
        return { rank: null, steps: 0 };
    const better = await db_1.prisma.contestEntry.count({
        where: { contestId, verified: true, steps: { gt: me.steps } }
    });
    return { rank: better + 1, steps: me.steps };
}
/**
 * POST /claim/start
 * body: { contestId }
 * -> creates claim (idempotent via @@unique) if eligible; returns { claimId, rank, status, waybillNo?, stateHint? }
 */
router.post('/start', /*auth,*/ async (req, res) => {
    const body = zod_1.z.object({ contestId: zod_1.z.number().int().positive() }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: '参数错误' });
    const contestId = body.data.contestId;
    // const uid = req.user!.uid;
    const uid = Number(req.user?.uid ?? 5);
    const now = new Date();
    const contest = await db_1.prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest)
        return res.status(404).json({ message: '赛事不存在' });
    // Only allow claim after contest ends
    if (contest.endAt > now)
        return res.status(400).json({ message: '赛事未结束，暂不可领取' });
    // Compute my rank
    const { rank, steps } = await computeRank(contestId, uid);
    if (!rank)
        return res.status(403).json({ message: '未参赛或成绩无效' });
    // Check eligibility
    if (rank > contest.rewardTopN) {
        return res.status(403).json({ message: '未在获奖名次内，无法领取' });
    }
    // Create or return existing claim (idempotent)
    const claim = await db_1.prisma.contestPrizeClaim.upsert({
        where: { contestId_userId: { contestId, userId: uid } },
        update: { rank, steps },
        create: {
            contestId,
            userId: uid,
            rank,
            steps,
            status: 'PENDING_INFO'
        }
    });
    return res.json({
        claimId: claim.id,
        rank: claim.rank,
        status: claim.status,
        waybillNo: claim.waybillNo ?? null,
        stateHint: claim.status === 'SHIPPED' ? '静待' : null
    });
});
/** Resolve a user's claimId for a given contest (used by "查看奖励" with contestId only) */
router.get('/by-contest', /* auth, */ async (req, res) => {
    const q = zod_1.z.object({ contestId: zod_1.z.coerce.number().int().positive() }).safeParse(req.query);
    if (!q.success)
        return res.status(400).json({ message: '参数错误' });
    const uid = Number(req.user?.uid ?? 5);
    const claim = await db_1.prisma.contestPrizeClaim.findUnique({
        where: { contestId_userId: { contestId: q.data.contestId, userId: uid } },
        select: { id: true }
    });
    if (!claim)
        return res.json({ claimId: null });
    return res.json({ claimId: claim.id });
});
/**
 * GET /claim/detail?claimId=...
 */
router.get('/detail', /*auth,*/ async (req, res) => {
    const q = zod_1.z.object({
        claimId: zod_1.z.coerce.number().int().positive(),
        contestId: zod_1.z.coerce.number().int().positive().optional(),
    }).safeParse(req.query);
    if (!q.success)
        return res.status(400).json({ message: '参数错误' });
    const uid = Number(req.user?.uid ?? 5);
    // let claim = null as Awaited<ReturnType<typeof prisma.contestPrizeClaim.findUnique>> | null;
    let claim = null;
    if (q.data.claimId) {
        claim = await db_1.prisma.contestPrizeClaim.findUnique({
            where: { id: q.data.claimId },
            include: {
                contest: { select: { title: true } },
                prize: { select: { title: true, valueCents: true } } // schema has no imageUrl
            }
        });
    }
    else if (q.data.contestId) {
        claim = await db_1.prisma.contestPrizeClaim.findFirst({
            where: { contestId: q.data.contestId, userId: uid },
            include: {
                contest: { select: { title: true } },
                prize: { select: { title: true, valueCents: true } }
            }
        });
    }
    else {
        return res.status(400).json({ message: '缺少 claimId 或 contestId' });
    }
    if (!claim || claim.userId !== uid)
        return res.status(404).json({ message: '未找到' });
    const prizeTitle = claim.prize?.title ?? '奖品';
    const imageUrl = '';
    const valueCents = claim.prize?.valueCents ?? null;
    const csWeChatId = process.env.CS_WECHAT_ID || '';
    const stateHint = (() => {
        switch (claim.status) {
            case client_1.PrizeClaimStatus.SHIPPED: return '静待';
            case client_1.PrizeClaimStatus.VERIFIED: return '待发货';
            case client_1.PrizeClaimStatus.SUBMITTED: return '已提交';
            case client_1.PrizeClaimStatus.COMPLETED: return '已完成';
            case client_1.PrizeClaimStatus.REJECTED: return '已驳回';
            default: return '';
        }
    })();
    res.json({
        claimId: claim.id,
        contestId: claim.contestId,
        title: claim.contest.title, // 赛事标题（前端当前用到：d.title）
        rank: claim.rank,
        status: claim.status,
        prizeTitle, // 可用于 modal 的 prizeTitle
        imageUrl, // 奖品图
        valueCents, // 如需展示“价值”
        taobaoLink: claim.taobaoLink ?? '',
        orderNo: claim.orderNo ?? '',
        waybillNo: claim.waybillNo ?? '',
        csWeChatId, // 客服微信（如需）
        stateHint // 文案：静待/待发货/已提交/...
    });
});
/**
 * POST /claim/self-service
 * body: { claimId, orderNo, taobaoLink?, useDouble? }
 */
router.post('/self-service', /*auth,*/ async (req, res) => {
    const body = zod_1.z.object({
        claimId: zod_1.z.number().int().positive(),
        orderNo: zod_1.z.string().min(6).max(64),
        taobaoLink: zod_1.z.string().url().optional(),
        useDouble: zod_1.z.boolean().optional()
    }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: '参数错误' });
    const { claimId, orderNo, taobaoLink, useDouble } = body.data;
    // const uid = req.user!.uid;
    const uid = Number(req.user?.uid ?? 5);
    const claim = await db_1.prisma.contestPrizeClaim.findUnique({ where: { id: claimId } });
    if (!claim || claim.userId !== uid)
        return res.status(404).json({ message: '未找到' });
    // 如需翻倍，检查翻倍库存
    if (useDouble) {
        const doubles = await db_1.prisma.doubleCredit.findMany({ where: { userId: uid } });
        const avail = doubles.reduce((a, b) => a + Math.max(0, b.qty - b.consumedQty), 0);
        if (avail <= 0)
            return res.status(400).json({ message: '翻倍次数不足' });
    }
    // only allow when pending/submitted
    if (!['PENDING_INFO', 'SUBMITTED', 'REJECTED'].includes(claim.status)) {
        return res.status(400).json({ message: '当前状态不可提交' });
    }
    // TODO: if you have referral double-check, validate here before honoring useDouble
    // const updated = await prisma.contestPrizeClaim.update({
    //   where: { id: claimId },
    //   data: {
    //     orderNo,
    //     taobaoLink: taobaoLink ?? claim.taobaoLink,
    //     useDouble: useDouble ?? claim.useDouble,
    //     status: 'SUBMITTED'
    //   }
    // });
    await db_1.prisma.contestPrizeClaim.update({
        where: { id: claimId },
        data: {
            status: 'SUBMITTED',
            orderNo,
            taobaoLink: taobaoLink ?? claim.taobaoLink,
            useDouble
        }
    });
    // 2) 消耗一次翻倍
    if (useDouble) {
        const bucket = await db_1.prisma.doubleCredit.findFirst({
            where: {
                userId: uid,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            orderBy: { id: 'asc' },
            take: 20
        });
        const usable = bucket && bucket.consumedQty < bucket.qty;
        if (!usable)
            throw new Error('no_double_credit');
        await db_1.prisma.doubleCredit.update({
            where: { id: bucket.id },
            data: { consumedQty: { increment: 1 } }
        });
    }
    return res.json({
        // claimId: updated.id,
        // status: updated.status,
        // stateHint: '已提交'
        ok: true
    });
});
/* =================== OPTIONAL: admin endpoints =================== */
/** POST /claim/admin/verify { claimId, pass, note? } */
router.post('/admin/verify', async (req, res) => {
    const body = zod_1.z.object({
        claimId: zod_1.z.number().int().positive(),
        pass: zod_1.z.boolean(),
        note: zod_1.z.string().max(200).optional()
    }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: '参数错误' });
    const { claimId, pass, note } = body.data;
    const status = pass ? 'VERIFIED' : 'REJECTED';
    const updated = await db_1.prisma.contestPrizeClaim.update({
        where: { id: claimId },
        data: { status, note: note ?? null }
    });
    res.json({ claimId: updated.id, status: updated.status });
});
/** POST /claim/admin/ship { claimId, waybillNo } */
router.post('/admin/ship', async (req, res) => {
    const body = zod_1.z.object({
        claimId: zod_1.z.number().int().positive(),
        waybillNo: zod_1.z.string().min(6).max(64)
    }).safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ message: '参数错误' });
    const updated = await db_1.prisma.contestPrizeClaim.update({
        where: { id: body.data.claimId },
        data: { waybillNo: body.data.waybillNo, status: 'SHIPPED' }
    });
    res.json({ claimId: updated.id, status: updated.status, waybillNo: updated.waybillNo });
});
exports.default = router;
