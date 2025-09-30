"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getUserByOpenId = getUserByOpenId;
exports.upsertUserByOpenid = upsertUserByOpenid;
exports.updateUserProfile = updateUserProfile;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
async function getUserById(id) {
    return db_1.prisma.user.findUnique({ where: { id } });
}
async function getUserByOpenId(openid) {
    return db_1.prisma.user.findUnique({ where: { openid } });
}
async function upsertUserByOpenid(openid, unionid) {
    return db_1.prisma.user.upsert({
        where: { openid },
        update: { unionid },
        create: {
            openid,
            unionid,
            wechatNick: '新用户',
            ageGroup: client_1.AgeGroup.ADULT,
            canParticipate: true,
            canBuyMembership: true,
            city: '未知',
        },
    });
}
async function updateUserProfile(id, data) {
    const { phone, ...rest } = data;
    return db_1.prisma.user.update({
        where: { id },
        data: {
            ...rest,
            // TODO: replace with AES later
            phoneEnc: phone ?? undefined,
        },
    });
}
