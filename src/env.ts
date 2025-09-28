import 'dotenv/config';

export const env = {
    port: Number(process.env.PORT || 8080),
    jwtSecret: process.env.JWT_SECRET || 'sport-mini-competition',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    dbUrl: process.env.DATABASE_URL!,
    redisUrl: process.env.REDIS_URL!,
    wechat: {
        appid: process.env.WECHART_APPID!,
        secret: process.env.WECHAT_SECRET!
    },
    maps: {
        amapKey: process.env.AMAP_KEY || '',
        wechatMapKey: process.env.WECHAT_MAP_KEY || ''
    },
    aes: {
        keyHex: process.env.AES_KEY_HEX!,
        ivHex: process.env.AES_IV_HEX!
    },
    feature: {
        ads: process.env.ENABLE_ADS === 'true',
        liveness: process.env.ENABLE_LIVENESS !== 'false'
    }
};