"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("../db");
const leaderboard_service_1 = require("../services/leaderboard.service");
node_cron_1.default.schedule('55 21 * * *', async () => {
    const active = await db_1.prisma.contest.findMany({ where: {} });
    for (const c of active) {
        await (0, leaderboard_service_1.finalize)(c.id);
    }
});
