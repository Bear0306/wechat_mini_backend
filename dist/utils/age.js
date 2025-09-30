"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyAgeGroup = classifyAgeGroup;
const luxon_1 = require("luxon");
const client_1 = require("@prisma/client");
function classifyAgeGroup(b) {
    // 用户的出生日期，可选（可能为空)
    if (!b)
        return {
            group: client_1.AgeGroup.ADULT,
            canParticipate: true,
            canBuyMembership: true
        };
    // 计算年龄
    const age = Math.floor(luxon_1.DateTime.now().diff(luxon_1.DateTime.fromJSDate(b), 'years').years);
    // 年龄判断逻辑
    if (age < 12)
        return {
            group: client_1.AgeGroup.BLOCKED_UNDER_12,
            canParticipate: false,
            canBuyMembership: false
        };
    if (age <= 18)
        return {
            group: client_1.AgeGroup.MINOR_12_18,
            canParticipate: true,
            canBuyMembership: false
        };
    if (age > 65)
        return {
            group: client_1.AgeGroup.SENIOR_65_PLUS,
            canParticipate: false,
            canBuyMembership: false
        };
    if (age > 60)
        return {
            group: client_1.AgeGroup.SENIOR_60_65,
            canParticipate: true,
            canBuyMembership: false
        };
    return {
        group: client_1.AgeGroup.ADULT,
        canParticipate: true,
        canBuyMembership: true
    };
}
