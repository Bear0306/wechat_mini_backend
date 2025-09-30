"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
// In-memory store for request counts
const memoryStore = new Map();
function rateLimit(prefix, limit = 60, windowSec = 60) {
    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] ||
            req.socket.remoteAddress ||
            'unknown';
        const key = `${prefix}:${ip}`;
        const now = Date.now();
        const entry = memoryStore.get(key);
        if (!entry || entry.expiresAt < now) {
            // new window starts
            memoryStore.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
            return next();
        }
        entry.count++;
        if (entry.count > limit) {
            return res.status(429).json({ message: 'Too many requests' });
        }
        next();
    };
}
