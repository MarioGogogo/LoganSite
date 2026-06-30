/**
 * H5 日志路由（对应 Java WebLogController + WebLogUploadController）。
 * 所有路径与原后端完全一致，保证 LoganSite 前端零改动：
 *   POST /logan/web/upload.json
 *   GET  /logan/web/search.json
 *   GET  /logan/web/latest.json
 *   GET  /logan/web/detailIndex.json
 *   GET  /logan/web/taskDetail.json
 *   GET  /logan/web/details.json
 *   GET  /logan/web/logDetail.json
 *   GET  /logan/web/getDownLoadUrl.json
 *   GET  /logan/web/download.json
 */
import { Hono } from 'hono';
import {
  batchInsertDetails,
  latestTasks,
  matchDetails,
  queryDetailById,
  queryDetailsByIds,
  queryTasksByIds,
  saveTask,
  searchTasks,
  updateTaskStatus,
} from '../lib/db';
import { parseWebLogArray, parseWebLogDetails } from '../lib/parser';
import {
  type LoganResponse,
  type WebLogDetail,
  type WebLogIndex,
  type WebLogTask,
  badParam,
  exception,
  ok,
  TaskStatus,
} from '../lib/types';

const ONE_DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 20;

/** 把 "12:05" 转成当天分钟偏移（对应 DateTimeUtil.getOffset） */
function parseOffset(hm: string | undefined, def: number): number {
  if (!hm) return def;
  const arr = hm.split(':');
  if (arr.length !== 2) return def;
  const h = parseInt(arr[0], 10) || 0;
  const m = parseInt(arr[1], 10) || 0;
  return h * 60 + m;
}

/** 逗号分隔的数字列表（对应 TypeSafeUtil.parseLongList + ignore 0） */
function parseLongList(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
}
function parseIntList(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}

/** 返回给前端的 task（去掉 content 字段，对应 @JsonIgnore） */
function publicTask(t: WebLogTask) {
  const { content, ...rest } = t;
  return rest;
}

export interface Env {
  DB: D1Database;
  H5_RSA_PRIVATE_KEY: string; // PKCS8 base64，wrangler secret put 注入
}

export const webRouter = new Hono<{ Bindings: Env }>();

/** POST /logan/web/upload.json —— 接收并存储 H5 上报 */
webRouter.post('/logan/web/upload.json', async (c) => {
  const model = await c.req.json<UploadModel>().catch(() => null);
  if (!model || !isValid(model)) {
    return c.json<LoganResponse<never>>(badParam('invalid params'));
  }
  const rsaKey = c.env.H5_RSA_PRIVATE_KEY;
  if (!rsaKey) return c.json<LoganResponse<never>>(exception('server missing RSA key'));

  const content = await parseWebLogArray(model.logArray, rsaKey);
  const now = Date.now();
  const success = await saveTask(
    c.env.DB,
    {
      deviceId: model.deviceId,
      webSource: model.webSource ?? '',
      environment: model.environment ?? '',
      pageNum: model.logPageNo,
      content,
      addTime: now,
      logDate: model.logDate!,
      customReportInfo: model.customInfo ?? '',
    },
    TaskStatus.NORMAL,
  );
  return c.json(success ? ok(true) : exception('save log error'));
});

interface UploadModel {
  deviceId: string;
  logPageNo: number;
  webSource?: string;
  environment?: string;
  logArray: string;
  fileDate: string;
  client?: string;
  customInfo?: string;
  logDate?: number; // 由 isValid 计算填入
}

/** 校验 + 计算 logDate（对应 WebLogTaskModel.isValid） */
function isValid(m: UploadModel): boolean {
  if (!m.deviceId || !m.logPageNo || m.logPageNo <= 0 || !m.logArray || !m.fileDate) return false;
  const ts = parseFileDate(m.fileDate);
  if (ts == null) return false;
  m.logDate = trimToHourTs(ts); // 截断到当天 0 点
  return true;
}
/** fileDate 格式 "yyyy-MM-dd"（对应原 DateFormatStyleEnum.DATE） */
function parseFileDate(s: string): number | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return Date.UTC(y, mo - 1, d); // 用 UTC 0 点
}
function trimToHourTs(ts: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor(ts / dayMs) * dayMs;
}

/** GET /logan/web/search.json */
webRouter.get('/logan/web/search.json', async (c) => {
  const beginTime = Number(c.req.query('beginTime') ?? 0);
  let endTime = Number(c.req.query('endTime') ?? 0) + ONE_DAY;
  const deviceId = c.req.query('deviceId') ?? '';
  if (beginTime <= 0 || !deviceId) return c.json<LoganResponse<never>>(badParam('invalid param'));
  const list = await searchTasks(c.env.DB, beginTime, endTime, deviceId);
  const result = reduceGroups(groupBy(list, (t) => t.logDate));
  return c.json(ok(result.map(publicTask)));
});

/** GET /logan/web/latest.json */
webRouter.get('/logan/web/latest.json', async (c) => {
  const list = await latestTasks(c.env.DB, 200);
  // 先按 logDate 分组，组内再按 deviceId 分组，每个 deviceId 组取一个代表
  const byDate = groupBy(list, (t) => t.logDate);
  const result: WebLogTask[] = [];
  for (const [, items] of byDate) {
    const byDevice = groupBy(items, (t) => t.deviceId);
    for (const [, ds] of byDevice) result.push(reduceGroup(ds));
  }
  result.sort((a, b) =>
    a.logDate === b.logDate ? b.addTime - a.addTime : b.logDate - a.logDate,
  );
  return c.json(ok(result.slice(0, PAGE_SIZE).map(publicTask)));
});

/** GET /logan/web/detailIndex.json —— 含懒解析 + 分页索引 */
webRouter.get('/logan/web/detailIndex.json', async (c) => {
  const taskIds = parseLongList(c.req.query('tasks'));
  const logTypes = parseIntList(c.req.query('logTypes'));
  const keyword = c.req.query('keyword') || undefined;
  const beginOffset = parseOffset(c.req.query('beginTime'), 0);
  const endOffset = parseOffset(c.req.query('endTime'), 23 * 60 + 59);

  const list = await queryTasksByIds(c.env.DB, taskIds);
  if (list.length === 0) return c.json<LoganResponse<never>>(badParam('empty tasks'));

  await doAnalyzeIfNotAnalyzed(c.env.DB, list);

  // 并发匹配（原 Java 用 20 线程 CountDownLatch，这里用 Promise.all）
  const matched = await Promise.all(
    taskIds.map((id) => matchDetails(c.env.DB, id, beginOffset, endOffset, logTypes, keyword)),
  );
  const cached: WebLogDetail[] = matched.flat().sort((a, b) => a.logTime - b.logTime);

  // 分页（每页 PAGE_SIZE）
  const pages: WebLogIndex[][] = [];
  let page: WebLogIndex[] = [];
  for (const d of cached) {
    page.push({ detailId: d.id, logType: d.logType, logTime: d.logTime });
    if (page.length === PAGE_SIZE) {
      pages.push(page);
      page = [];
    }
  }
  if (page.length > 0) pages.push(page);
  return c.json(ok(pages));
});

/** GET /logan/web/taskDetail.json */
webRouter.get('/logan/web/taskDetail.json', async (c) => {
  const ids = parseLongList(c.req.query('tasks'));
  if (ids.length === 0) return c.json<LoganResponse<never>>(badParam('task not found'));
  const list = await queryTasksByIds(c.env.DB, ids);
  if (list.length === 0) return c.json<LoganResponse<never>>(badParam('task not found'));
  list.sort((a, b) => a.pageNum - b.pageNum);
  return c.json(ok(publicTask(list[0])));
});

/** GET /logan/web/details.json */
webRouter.get('/logan/web/details.json', async (c) => {
  const ids = parseLongList(c.req.query('detailIds'));
  if (ids.length === 0) return c.json<LoganResponse<never>>(badParam(`not details for ${c.req.query('detailIds')}`));
  const list = await queryDetailsByIds(c.env.DB, ids);
  if (list.length === 0) return c.json<LoganResponse<never>>(badParam(`not details for ${c.req.query('detailIds')}`));
  return c.json(ok(list.map(publicDetail)));
});

/** GET /logan/web/logDetail.json */
webRouter.get('/logan/web/logDetail.json', async (c) => {
  const id = Number(c.req.query('detailId') ?? 0);
  const d = id > 0 ? await queryDetailById(c.env.DB, id) : null;
  if (!d) return c.json<LoganResponse<never>>(badParam('log detail not found'));
  return c.json(ok(publicDetail(d)));
});

/** GET /logan/web/getDownLoadUrl.json */
webRouter.get('/logan/web/getDownLoadUrl.json', async (c) => {
  const tasks = c.req.query('tasks') ?? '';
  return c.json(ok(`/logan/web/download.json?tasks=${tasks}`));
});

/** GET /logan/web/download.json —— 拼接原始 content 返回二进制 */
webRouter.get('/logan/web/download.json', async (c) => {
  const ids = parseLongList(c.req.query('tasks'));
  const tasks = await queryTasksByIds(c.env.DB, ids);
  tasks.sort((a, b) => a.pageNum - b.pageNum);
  const buf = tasks.map((t) => t.content).join('');
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${c.req.query('tasks')}"`,
    },
  });
});

// ---------- 业务辅助（对应 Java 私有方法） ----------

function publicDetail(d: WebLogDetail) {
  return { id: d.id, taskId: d.taskId, logType: d.logType, content: d.content, logTime: d.logTime, logLevel: d.logLevel };
}

/** 懒解析：未分析过的 task，解析明细入库并置 ANALYZED */
async function doAnalyzeIfNotAnalyzed(db: D1Database, list: WebLogTask[]): Promise<void> {
  list.sort((a, b) => a.pageNum - b.pageNum);
  const now = Date.now();
  for (const t of list) {
    if (t.status === TaskStatus.NORMAL) {
      const details = parseWebLogDetails(t.content, t.taskId, now);
      await batchInsertDetails(db, details);
      await updateTaskStatus(db, t.taskId, TaskStatus.ANALYZED);
    }
  }
}

/** 把同组（同 key）的多 task 合并为一个代表，tasks 字段拼接该组所有 taskId（对应 Java reduce）。
 *  注意：对"已经分好的一组数组"做合并，返回单个代表。 */
function reduceGroup(items: WebLogTask[]): WebLogTask {
  items.sort((a, b) => a.pageNum - b.pageNum);
  const head = items[0];
  head.tasks = items.map((t) => t.taskId).join(',');
  return head;
}

/** 对一个分组 Map，每组取一个代表，返回代表列表 */
function reduceGroups<T>(group: Map<T, WebLogTask[]>): WebLogTask[] {
  const out: WebLogTask[] = [];
  for (const [, items] of group) out.push(reduceGroup(items));
  return out;
}

function groupBy<T>(list: WebLogTask[], keyFn: (t: WebLogTask) => T): Map<T, WebLogTask[]> {
  const m = new Map<T, WebLogTask[]>();
  for (const t of list) {
    const k = keyFn(t);
    const arr = m.get(k) ?? [];
    arr.push(t);
    m.set(k, arr);
  }
  return m;
}
