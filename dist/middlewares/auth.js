"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sign = sign;
exports.auth = auth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
function sign(uid) {
    return jsonwebtoken_1.default.sign({ uid }, env_1.env.jwtSecret);
}
function auth(req, res, next) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        const uid = typeof payload.uid === 'string' ? Number(payload.uid) : payload.uid;
        if (!Number.isFinite(uid)) {
            return res.status(401).json({ error: 'Invalid token uid' });
        }
        req.userId = uid;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Unauthorized' });
    }
}
