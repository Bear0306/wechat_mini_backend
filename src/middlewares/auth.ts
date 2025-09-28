import { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { env } from '../env';

export type AuthUser = {
    uid: string
};

export function sign(uid: string | number) {
    return jwt.sign(
        { uid }, 
        env.jwtSecret, 
        // { expiresIn: env.jwtExpiresIn }
    );
}

export interface AuthedRequest extends Request {
    userId?: number;
}

export function auth(req: Request & { user?:AuthUser }, res: Response, next: NextFunction) {
    const token=(req.headers.authorization || '').replace(/^Bearer\s+/i,'');
    
    if (!token)
        return res.status(401).json({ message: 'Unauthorized' });

    try {
        const payload = jwt.verify(token, env.jwtSecret) as { uid: number | string };
        const uid = typeof payload.uid === 'string' ? Number(payload.uid) : payload.uid;

        if (!Number.isFinite(uid)) {
            return res.status(401).json({ error: 'Invalid token uid' });
        }

        (req as any).userId = uid;

        next();
    } catch {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}