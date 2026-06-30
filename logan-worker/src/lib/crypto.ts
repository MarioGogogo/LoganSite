/**
 * H5 日志解密（对应 Java WebLogDecryptHelper）。
 *
 * 原算法：
 *   1. 用全局 RSA 私钥（PKCS8）对客户端上报的 `k` 字段做 RSA 解密（JDK 默认 RSA/ECB/PKCS1Padding）→ 得到 AES key（16 字节）。
 *   2. 用 AES key + 客户端 `iv` 做 AES/CTR/NoPadding 解密 `l` 字段 → 明文日志。
 *
 * Web Crypto 对应：
 *   1. subtle.decrypt({ name: 'RSAES-PKCS1-v1_5' }, privateKey, keyCipher)  —— 等价 JDK "RSA" 的默认 PKCS1Padding
 *      （注意：Workers 用算法名 RSAES-PKCS1-v1_5，不是 Node 文档里的 RSA-PKCS1）
 *   2. subtle.decrypt({ name: 'AES-CTR', counter: iv, length: 64 }, aesKey, content)
 */

/** base64 → Uint8Array（兼容 Workers 的 atob） */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 导入 RSA 私钥（PKCS8 DER base64） */
async function importRsaPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  const der = base64ToBytes(pkcs8Base64);
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSAES-PKCS1-v1_5' }, false, ['decrypt']);
}

/**
 * 用 RSA 私钥解密出 AES key（对应 Java getPrivateKey）。
 * 返回原始 AES key 字节。
 */
export async function rsaDecryptAesKey(
  rsaPrivateKeyPkcs8: string,
  encryptedKeyBase64: string,
): Promise<Uint8Array | null> {
  try {
    const key = await importRsaPrivateKey(rsaPrivateKeyPkcs8);
    const cipher = base64ToBytes(encryptedKeyBase64);
    const raw = await crypto.subtle.decrypt({ name: 'RSAES-PKCS1-v1_5' }, key, cipher);
    return new Uint8Array(raw);
  } catch {
    return null;
  }
}

/**
 * AES/CTR/NoPadding 解密（对应 Java doDecrypt）。
 * iv 来自客户端，原 Java 用 iv.getBytes()（UTF-8 字节，长度需为 16）。
 */
export async function aesCtrDecrypt(
  aesKey: Uint8Array,
  ivBase64: string,
  contentBase64: string,
): Promise<string | null> {
  try {
    const iv = base64ToBytes(ivBase64);
    const content = base64ToBytes(contentBase64);
    const key = await crypto.subtle.importKey('raw', aesKey, { name: 'AES-CTR' }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: iv, length: 64 }, // CTR 用前 8 字节作计数器（64 bit），与 Java 默认一致
      key,
      content,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
