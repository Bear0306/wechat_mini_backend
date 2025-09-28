import { Router } from 'express';
import { z } from 'zod';
import {
  getLeaderboardPage,
  getMyRank,
  getSnapshot
} from '../services/leaderboard.service';
import type { Scope } from '../utils/time';
// 可选：基于 JWT 的用户鉴权
import { auth } from '../middlewares/auth';

const router = Router();

/* -------------------- Contest leaderboard (by contestId) -------------------- */

// GET /leaderboard/list?contestId=123&page=1&size=30
router.get('/list', async (req, res) => {
  const q = z.object({
    contestId: z.coerce.number().int().positive(),
    scope: z.enum(['day', 'week', 'month']).default('day'),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(30),
  }).parse(req.query);

  const data = await getLeaderboardPage(q.scope as Scope, q.contestId, q.page, q.size);
  res.json(data);
});

// GET /leaderboard/my-rank?contestId=123
// 优先用 auth 中的 uid；若无，则接受 query.userId（用于测试）
router.get('/my-rank', async (req: any, res) => {
  const q = z.object({
    scope: z.enum(['day', 'week', 'month']).default('day'),
    contestId: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive().optional(),
  }).parse(req.query);

  let uid: number | undefined = q.userId ?? 5;
  if (req.user?.uid && Number.isFinite(req.user.uid)) {
    uid = Number(req.user.uid);
  }
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  const me = await getMyRank(q.scope, q.contestId, uid);
  if (!me) return res.status(204).end();
  res.json(me);
});

// GET /leaderboard/snapshot?contestId=123
// 同样优先 auth，再 fallback query.userId
router.get('/snapshot', async (req: any, res) => {
  const q = z.object({
    contestId: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive().optional(),
  }).parse(req.query);

  // let uid: number | undefined = q.userId;
  let uid = 5;
  if (req.user?.uid && Number.isFinite(req.user.uid)) {
    uid = Number(req.user.uid);
  }

  const snap = await getSnapshot(q.contestId, uid);
  res.json(snap);
});

export default router;
