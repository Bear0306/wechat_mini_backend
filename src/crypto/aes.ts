import crypto from 'crypto';
import { env } from '../env';

// 从环境变量中读取 AES Key 与 IV（必须是 hex 编码的字符串）
const key = Buffer.from(env.aes.keyHex, 'hex');
const iv = Buffer.from(env.aes.ivHex, 'hex');

/**
 * 使用 AES-256-CBC 算法加密字符串
 * @param plain 明文字符串
 * @returns base64 编码的密文
 */
export function aesEncrypt(plain: string) {
    // 创建加密器 (Cipher) - AES-256-CBC 模式
    const c = crypto.createCipheriv('aes-256-cbc', key, iv);
    // 执行加密并拼接最终结果
    const e = Buffer.concat([
        c.update(Buffer.from(plain,'utf8')),
        c.final()
    ]);
    
    // 返回 Base64 编码的密文
    return e.toString('base64');
}

/**
 * 使用 AES-256-CBC 算法解密 Base64 密文
 * @param b64 Base64 编码的密文
 * @returns 明文字符串
 */
export function aesDecrypt(b64: string) {
    // 将 Base64 转为二进制
    const d = Buffer.from(b64,'base64');
    // 创建解密器 (Decipher) - AES-256-CBC 模式
    const dc = crypto.createDecipheriv('aes-256-cbc', key, iv);
    // 执行解密并拼接最终结果
    const o = Buffer.concat([
        dc.update(d),
        dc.final()
    ]);
    
    // 返回 UTF-8 明文
    return o.toString('utf8');
}