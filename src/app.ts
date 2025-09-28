import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import contestRoutes from './routes/contest.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import referralRoutes from './routes/referral.routes';
import membershipRoutes from './routes/membership.routes';
import rewardRoutes from './routes/reward.routes';
// import quotaRoutes from './routes/quota.routes';
import './jobs/finalizeLeaderboards';
import { rateLimit } from './middlewares/rateLimit';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

app.use('/api/auth', rateLimit('auth', 30, 60), authRoutes);
app.use('/api/user', rateLimit('user', 120, 60), userRoutes);
app.use('/api/contest', rateLimit('contest', 120, 60), contestRoutes);
app.use('/api/leaderboard', rateLimit('board', 120, 60), leaderboardRoutes);
app.use('/api/referral', rateLimit('ref', 60, 60), referralRoutes);
app.use('/api/membership', rateLimit('member', 30, 60), membershipRoutes);
app.use('/api/reward', rateLimit('reward', 30, 60), rewardRoutes);
// app.use('/api/quota', rateLimit('reward', 30, 60), quotaRoutes);
app.get('/api/health', (_req, res) => res.json({
    ok: true,
    disclaimer: '参赛者需自行评估身体状况，平台方不承担运动损伤责任！禁止在危险区域运动，参赛者因场地选择不当受伤或造成损失的自行负责'
}));

app.listen(env.port, () => console.log('Backend running at https://localhost:' + env.port));