import { Router } from 'express';
import { z } from 'zod';
import { code2Session } from '../adapters/wechat';
import { upsertUserByOpenid } from '../services/user.service';
import { sign } from '../middlewares/auth';
import { prisma } from '../db';

const router=Router();

router.post('/login', async(req, res) => {
    const body = z.object({ code: z.string().min(1) }).parse(req.body);
    // const session = await code2Session(body.code);

    // const user = await upsertUserByOpenid(session.openid, session.unionid);
    // const token = sign(user.id);

    // return res.json({ token, openid: session.openid });

    try {
        const openid = 'mock_' + body.code;
        let user = await prisma.user.findUnique({ where: { openid } });

        if (!user) {
        user = await prisma.user.create({
            data: { openid, wechatNick: '新用户', city: '未知' },
        });
        }

        const token = sign(user.id);
        return res.json({ token, openid: user.openid });
    } catch (e: any) {
        return res.status(400).json({ error: e.message });
    }

});

export default router;
