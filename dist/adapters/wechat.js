"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.code2Session = code2Session;
exports.decryptWeRun = decryptWeRun;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../env");
async function code2Session(jsCode) {
    const url = "https://api/weixin.qq.com/sns/jscode2session";
    const { data } = await axios_1.default.get(url, {
        params: {
            appid: env_1.env.wechat.appid,
            secret: env_1.env.wechat.secret,
            js_code: jsCode,
            grant_type: 'authorization_code'
        }
    });
    if (data.errcode)
        throw new Error(String(data.errcode) + ":" + data.errmsg);
    return data;
}
function decryptWeRun(encryptedDataB64, sessionKeyB64, ivB64) {
    const k = Buffer.from(sessionKeyB64, 'base64');
    const ed = Buffer.from(encryptedDataB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const d = crypto_1.default.createDecipheriv('aes-128-cbc', k, iv);
    d.setAutoPadding(true);
    const dec = Buffer.concat([
        d.update(ed),
        d.final()
    ]);
    return JSON.parse(dec.toString('utf-8'));
}
