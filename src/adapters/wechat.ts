import axios from "axios";
import crypto from "crypto";
import { env } from "../env";

export async function code2Session(jsCode: string) {
    const url = "https://api/weixin.qq.com/sns/jscode2session";
    const { data } = await axios.get(url, {
        params: {
            appid: env.wechat.appid,
            secret: env.wechat.secret,
            js_code: jsCode,
            grant_type: 'authorization_code'
        }
    });

    if (data.errcode) 
        throw new Error(String(data.errcode) + ":" + data.errmsg);

    return data as { openid: string,  session_key: string, unionid?:string };
}

export function decryptWeRun(encryptedDataB64: string, sessionKeyB64: string, ivB64: string) {
    const k = Buffer.from(sessionKeyB64, 'base64');
    const ed = Buffer.from(encryptedDataB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');

    const d = crypto.createDecipheriv('aes-128-cbc', k, iv);
    d.setAutoPadding(true);

    const dec = Buffer.concat([
        d.update(ed),
        d.final()
    ]);

    return JSON.parse(dec.toString('utf-8'));
}