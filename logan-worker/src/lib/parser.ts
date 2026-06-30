/**
 * H5 日志解析（对应 Java WebLogParser）。
 *
 * upload 时：logArray 是逗号分隔的多项，每项是 URL-encoded 的 JSON：
 *   { v: 0|1, l: <base64 日志体>, iv?, k? }
 *   - v=0: l 直接 base64 解码即明文。
 *   - v=1: 先用 RSA 私钥解 k 得 AES key，再用 iv + AES key AES/CTR 解 l。
 * 解析结果是一个「明文日志字符串数组」的 JSON 字符串，整体存进 web_task.content。
 *
 * detailIndex 触发懒解析时：再把 content(JSON 数组) 每项解析成 {t,c,d} 的明细行入库。
 */
import { Field, type WebLogDetail } from './types';
import { aesCtrDecrypt, base64ToBytes, rsaDecryptAesKey } from './crypto';

interface RawItem {
  v?: number;
  l?: string;
  iv?: string;
  k?: string;
}

/** URL decode（对应 Java URLDecoder.decode） */
function urlDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * 对应 WebLogParser.parse：解析上报的 logArray，返回序列化后的明文日志数组 JSON 字符串。
 * 失败的项会被跳过（与 Java 行为一致：失败不抛，跳过该条）。
 */
export async function parseWebLogArray(
  logArray: string,
  rsaPrivateKeyPkcs8: string,
): Promise<string> {
  const logs: string[] = [];
  const items = logArray.split(',');
  for (const item of items) {
    const content = urlDecode(item);
    let obj: RawItem;
    try {
      obj = JSON.parse(content);
    } catch {
      continue;
    }
    const version = Number(obj.v ?? 0);
    if (version === 0) {
      // base64 解码即明文
      if (obj.l) {
        try {
          logs.push(new TextDecoder().decode(base64ToBytes(obj.l)));
        } catch {
          /* skip */
        }
      }
    } else if (version === 1) {
      if (obj.iv && obj.k && obj.l) {
        const aesKey = await rsaDecryptAesKey(rsaPrivateKeyPkcs8, obj.k);
        if (aesKey) {
          const plain = await aesCtrDecrypt(aesKey, obj.iv, obj.l);
          if (plain != null) logs.push(plain);
        }
      }
    }
  }
  return JSON.stringify(logs);
}

/**
 * 对应 WebLogParser.parseOneLogItem + parseWebLogDetail：
 * 把 content(明文日志数组 JSON) 每项解析成 web_detail 行。
 * 每项是 { t: 日志类型, c: 日志内容, d: 日志时间戳(ms) }。
 */
export function parseWebLogDetails(content: string, taskId: number, now: number): WebLogDetail[] {
  let arr: unknown[];
  try {
    arr = JSON.parse(content);
  } catch {
    return [];
  }
  const result: WebLogDetail[] = [];
  if (!Array.isArray(arr)) return result;
  for (const raw of arr) {
    if (typeof raw !== 'string') continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue;
    }
    const logType = String(obj[Field.LOG_TYPE] ?? '');
    const c = obj[Field.CONTENT];
    const logTime = String(obj[Field.LOG_TIME] ?? '');
    if (!logType || c == null || !logTime) continue;
    const ts = Number(logTime);
    result.push({
      id: 0,
      taskId,
      logType: Number(logType) || 0,
      content: urlDecode(typeof c === 'string' ? c : JSON.stringify(c)),
      logTime: ts,
      logLevel: 0,
      addTime: now,
      minuteOffset: getDayOffset(ts),
    });
  }
  return result;
}

/**
 * 当天 0 点起的分钟数 (0..1439)。对应 Java DateTimeUtil.getDayOffset。
 * 注意：原 Java 用默认时区截断到 0 点。这里用 UTC 截断——若部署时区与客户端上报约定不同，需对齐。
 */
export function getDayOffset(tsMs: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDayUtc = Math.floor(tsMs / dayMs) * dayMs;
  return Math.floor((tsMs - startOfDayUtc) / 60000);
}
