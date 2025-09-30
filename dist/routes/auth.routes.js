"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    const body = zod_1.z.object({ code: zod_1.z.string().min(1) }).parse(req.body);
    // const session = await code2Session(body.code);
    // const user = await upsertUserByOpenid(session.openid, session.unionid);
    // const token = sign(user.id);
    // return res.json({ token, openid: session.openid });
    try {
        const openid = 'mock_' + body.code;
        let user = await db_1.prisma.user.findUnique({ where: { openid } });
        if (!user) {
            user = await db_1.prisma.user.create({
                data: { openid, wechatNick: '新用户', city: '未知' },
            });
        }
        const token = (0, auth_1.sign)(user.id);
        return res.json({ token, openid: user.openid });
    }
    catch (e) {
        return res.status(400).json({ error: e.message });
    }
});
exports.default = router;
