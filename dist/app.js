"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./env");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const contest_routes_1 = __importDefault(require("./routes/contest.routes"));
const leaderboard_routes_1 = __importDefault(require("./routes/leaderboard.routes"));
const referral_routes_1 = __importDefault(require("./routes/referral.routes"));
const membership_routes_1 = __importDefault(require("./routes/membership.routes"));
const reward_routes_1 = __importDefault(require("./routes/reward.routes"));
// import quotaRoutes from './routes/quota.routes';
require("./jobs/finalizeLeaderboards");
const rateLimit_1 = require("./middlewares/rateLimit");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)('tiny'));
app.use('/api/auth', (0, rateLimit_1.rateLimit)('auth', 30, 60), auth_routes_1.default);
app.use('/api/user', (0, rateLimit_1.rateLimit)('user', 120, 60), user_routes_1.default);
app.use('/api/contest', (0, rateLimit_1.rateLimit)('contest', 120, 60), contest_routes_1.default);
app.use('/api/leaderboard', (0, rateLimit_1.rateLimit)('board', 120, 60), leaderboard_routes_1.default);
app.use('/api/referral', (0, rateLimit_1.rateLimit)('ref', 60, 60), referral_routes_1.default);
app.use('/api/membership', (0, rateLimit_1.rateLimit)('member', 30, 60), membership_routes_1.default);
app.use('/api/reward', (0, rateLimit_1.rateLimit)('reward', 30, 60), reward_routes_1.default);
// app.use('/api/quota', rateLimit('reward', 30, 60), quotaRoutes);
app.get('/api/health', (_req, res) => res.json({
    ok: true,
    disclaimer: '参赛者需自行评估身体状况，平台方不承担运动损伤责任！禁止在危险区域运动，参赛者因场地选择不当受伤或造成损失的自行负责'
}));
app.listen(env_1.env.port, () => console.log('Backend running at https://localhost:' + env_1.env.port));
