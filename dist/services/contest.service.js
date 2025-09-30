"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateContest = getOrCreateContest;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const luxon_1 = require("luxon");
async function getOrCreateContest(cityCode, heatLevel) {
    const frequency = heatLevel >= 4 ? client_1.ContestFreq.DAILY : client_1.ContestFreq.WEEKLY;
    const now = luxon_1.DateTime.now();
    const startLux = frequency === client_1.ContestFreq.DAILY ? now.startOf('day') : now.startOf('week');
    const endLux = frequency === client_1.ContestFreq.DAILY ? now.endOf('day') : now.endOf('week');
    const startAt = startLux.toJSDate();
    const endAt = endLux.toJSDate();
    // You may filter by FK scalar in where:
    const existing = await db_1.prisma.contest.findFirst({
        where: {
            scope: client_1.ContestScope.CITY,
            regionCode: cityCode,
            frequency,
            startAt: { lte: now.toJSDate() },
            endAt: { gte: now.toJSDate() },
        },
    });
    if (existing)
        return existing;
    const title = `${cityCode} ${frequency === client_1.ContestFreq.DAILY ? 'Daily' : 'Weekly'} ${startLux.toISODate()}`;
    return db_1.prisma.contest.create({
        data: {
            title,
            scope: client_1.ContestScope.CITY,
            heatLevel,
            frequency,
            prizeMin: heatLevel >= 4 ? 100 : 50,
            prizeMax: heatLevel >= 4 ? 500 : 200,
            startAt,
            endAt,
            // 👇 must set the relation (checked create hides regionCode)
            region: { connect: { code: cityCode } },
        },
    });
}
