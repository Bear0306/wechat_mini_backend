"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tierConfig = tierConfig;
exports.upsertMembership = upsertMembership;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const luxon_1 = require("luxon");
function tierConfig(t) {
    if (t === client_1.MembershipTier.VIP)
        return { monthlyQuota: 12, carryOverMax: 12, autoJoin: false };
    if (t === client_1.MembershipTier.VIP_PLUS)
        return { monthlyQuota: 20, carryOverMax: 20, autoJoin: true };
    return { monthlyQuota: 0, carryOverMax: 0, autoJoin: false };
}
async function upsertMembership(userId, // accept both
tier, months = 1) {
    // Coerce to number because Prisma type expects number for userId
    const uid = typeof userId === "string" ? Number(userId) : userId;
    if (!Number.isFinite(uid)) {
        throw new TypeError("userId must be a number or a numeric string");
    }
    const now = luxon_1.DateTime.now();
    const ex = await db_1.prisma.membership.findUnique({
        where: { userId: uid }, // ✅ number
    });
    const cfg = tierConfig(tier);
    if (!ex) {
        return db_1.prisma.membership.create({
            data: {
                userId: uid, // ✅ number
                tier,
                startAt: now.toJSDate(),
                endAt: now.plus({ months }).toJSDate(),
                monthlyQuota: cfg.monthlyQuota,
                carryOver: 0,
                autoJoin: cfg.autoJoin,
            },
        });
    }
    const carry = Math.min(ex.carryOver + ex.monthlyQuota, cfg.carryOverMax); // ✅ fixed key
    const currentEnd = luxon_1.DateTime.fromJSDate(ex.endAt);
    const newEnd = (currentEnd < now ? now : currentEnd).plus({ months });
    return db_1.prisma.membership.update({
        where: { userId: uid }, // ✅ number
        data: {
            tier,
            endAt: newEnd.toJSDate(),
            monthlyQuota: cfg.monthlyQuota,
            carryOver: carry,
            autoJoin: cfg.autoJoin,
        },
    });
}
