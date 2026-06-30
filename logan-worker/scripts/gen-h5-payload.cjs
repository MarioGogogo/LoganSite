/**
 * 模拟 H5 客户端上报 v=1 加密日志，用于联调 Workers 解密链路。
 *
 * 用 Java 源码里的 demo RSA 私钥推导出公钥，
 * 流程与 Logan H5 SDK 一致：
 *   1. 随机生成 16 字节 AES key + 16 字节 IV
 *   2. 用 RSA 公钥加密 AES key → k
 *   3. 用 AES/CTR(iv) 加密明文日志 → l
 *   4. 组装 {v:1, l, iv, k}（base64），URL-encode 后逗号拼接成 logArray
 *
 * 用法: node scripts/gen-h5-payload.cjs "<明文日志JSON>"
 */
const crypto = require('crypto');

// 与 .dev.vars 中 H5_RSA_PRIVATE_KEY 对应的公钥（PKCS1 PEM）。
const RSA_PUBLIC_KEY_PEM = `-----BEGIN RSA PUBLIC KEY-----
MIGJAoGBAMZuPHgp1eHm75mqi2Mm5HCQ0vMCrbxlZGoQfX+gVr17A+Nr/1jNqzHG
ZVN6wPRCESjJCSAfg+e5q+YjgLucZ7ns8jXg7yKqGOEE1dgzwmgchamPqcHjjQgw
t0VPHN4Za0yqCcZdYS9hbsMTjIoAxPSy02kjdClaNLelDd/2DbHvAgMBAAE=
-----END RSA PUBLIC KEY-----`;

const plaintext = process.argv[2] || JSON.stringify({ t: 2, c: '加密日志测试 🔒', d: Date.now() });

const publicKeyObj = crypto.createPublicKey(RSA_PUBLIC_KEY_PEM);

// 1. AES key + IV（与 Java 一致：iv 是 16 字节随机，AES key 16 字节）
const aesKey = crypto.randomBytes(16);
const iv = crypto.randomBytes(16);

// 2. RSA 加密 AES key（PKCS1 padding，对应 JDK 默认 "RSA"）
const encKey = crypto.publicEncrypt(
  { key: publicKeyObj, padding: crypto.constants.RSA_PKCS1_PADDING },
  aesKey,
);

// 3. AES-128-CTR 加密明文
const cipher = crypto.createCipheriv('aes-128-ctr', aesKey, iv);
const encContent = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);

const item = {
  v: 1,
  l: encContent.toString('base64'),
  iv: iv.toString('base64'),
  k: encKey.toString('base64'),
};

const logArrayItem = encodeURIComponent(JSON.stringify(item));
console.log(logArrayItem);
console.error('明文: ' + plaintext);
