"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const leaderboard_service_1 = require("../services/leaderboard.service");
const router = (0, express_1.Router)();
/* -------------------- Contest leaderboard (by contestId) -------------------- */
// GET /leaderboard/list?contestId=123&page=1&size=30
router.get('/list', async (req, res) => {
    const q = zod_1.z.object({
        contestId: zod_1.z.coerce.number().int().positive(),
        scope: zod_1.z.enum(['day', 'week', 'month']).default('day'),
        page: zod_1.z.coerce.number().int().min(1).default(1),
        size: zod_1.z.coerce.number().int().min(1).max(100).default(30),
    }).parse(req.query);
    const data = await (0, leaderboard_service_1.getLeaderboardPage)(q.scope, q.contestId, q.page, q.size);
    res.json(data);
});
// GET /leaderboard/my-rank?contestId=123
// 优先用 auth 中的 uid；若无，则接受 query.userId（用于测试）
router.get('/my-rank', async (req, res) => {
    const q = zod_1.z.object({
        scope: zod_1.z.enum(['day', 'week', 'month']).default('day'),
        contestId: zod_1.z.coerce.number().int().positive(),
        userId: zod_1.z.coerce.number().int().positive().optional(),
    }).parse(req.query);
    let uid = q.userId ?? 5;
    if (req.user?.uid && Number.isFinite(req.user.uid)) {
        uid = Number(req.user.uid);
    }
    if (!uid)
        return res.status(401).json({ error: 'unauthorized' });
    const me = await (0, leaderboard_service_1.getMyRank)(q.scope, q.contestId, uid);
    if (!me)
        return res.status(204).end();
    res.json(me);
});
// GET /leaderboard/snapshot?contestId=123
// 同样优先 auth，再 fallback query.userId
router.get('/snapshot', async (req, res) => {
    const q = zod_1.z.object({
        contestId: zod_1.z.coerce.number().int().positive(),
        userId: zod_1.z.coerce.number().int().positive().optional(),
    }).parse(req.query);
    // let uid: number | undefined = q.userId;
    let uid = 5;
    if (req.user?.uid && Number.isFinite(req.user.uid)) {
        uid = Number(req.user.uid);
    }
    const snap = await (0, leaderboard_service_1.getSnapshot)(q.contestId, uid);
    res.json(snap);
});
exports.default = router;
