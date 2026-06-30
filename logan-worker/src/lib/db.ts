/**
 * D1 数据访问层（对应 MyBatis WebLogTaskMapper / WebLogDetailMapper + Service）。
 * 所有 SQL 与原 MySQL 一致，仅适配 SQLite 占位符（? 而非 #{name}）。
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { WebLogDetail, WebLogTask } from './types';

/** 把 DB 行映射成 WebLogTask（列名驼峰转换） */
interface WebTaskRow {
  id: number;
  device_id: string;
  web_source: string | null;
  environment: string | null;
  page_num: number;
  content: string;
  add_time: number;
  log_date: number;
  status: number;
  custom_report_info: string | null;
  update_time: number | null;
}
function rowToTask(r: WebTaskRow): WebLogTask {
  return {
    taskId: r.id,
    deviceId: r.device_id,
    webSource: r.web_source ?? '',
    environment: r.environment ?? '',
    pageNum: r.page_num,
    content: r.content,
    addTime: r.add_time,
    logDate: r.log_date,
    status: r.status,
    customReportInfo: r.custom_report_info ?? '',
    updateTime: r.update_time ?? 0,
  };
}

// ---------- web_task ----------

/** saveTask：先查重 (logDate,deviceId,pageNum)，存在则更新 content，否则插入。返回是否成功。 */
export async function saveTask(
  db: D1Database,
  task: Omit<WebLogTask, 'taskId' | 'status' | 'updateTime'>,
  status = 0,
): Promise<boolean> {
  const exist = await db
    .prepare('SELECT * FROM web_task WHERE log_date=? AND device_id=? AND page_num=? LIMIT 1')
    .bind(task.logDate, task.deviceId, task.pageNum)
    .first<WebTaskRow>();
  if (exist) {
    await db.prepare('UPDATE web_task SET content=? WHERE id=?').bind(task.content, exist.id).run();
    return true;
  }
  const res = await db
    .prepare(
      'INSERT INTO web_task (device_id,web_source,environment,page_num,content,add_time,log_date,status,custom_report_info,update_time) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      task.deviceId,
      task.webSource,
      task.environment,
      task.pageNum,
      task.content,
      task.addTime,
      task.logDate,
      status,
      task.customReportInfo,
      task.addTime,
    )
    .run();
  return res.success;
}

export async function searchTasks(
  db: D1Database,
  beginTime: number,
  endTime: number,
  deviceId: string,
): Promise<WebLogTask[]> {
  const { results } = await db
    .prepare('SELECT * FROM web_task WHERE add_time BETWEEN ? AND ? AND device_id=?')
    .bind(beginTime, endTime, deviceId)
    .all<WebTaskRow>();
  return (results ?? []).map(rowToTask);
}

/** latest：取 max(id)，再取 [max(0,maxId-count), maxId] 区间 */
export async function latestTasks(db: D1Database, count: number): Promise<WebLogTask[]> {
  const max = await db.prepare('SELECT MAX(id) AS m FROM web_task').first<{ m: number | null }>();
  const maxId = max?.m ?? 0;
  const minId = Math.max(0, maxId - count);
  const { results } = await db
    .prepare(
      'SELECT id,device_id,web_source,environment,page_num,content,add_time,log_date,custom_report_info,status,update_time FROM web_task WHERE id BETWEEN ? AND ?',
    )
    .bind(minId, maxId)
    .all<WebTaskRow>();
  return (results ?? []).map(rowToTask);
}

export async function queryTasksByIds(db: D1Database, ids: number[]): Promise<WebLogTask[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT * FROM web_task WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<WebTaskRow>();
  return (results ?? []).map(rowToTask);
}

export async function updateTaskStatus(db: D1Database, taskId: number, status: number): Promise<void> {
  await db.prepare('UPDATE web_task SET status=? WHERE id=?').bind(status, taskId).run();
}

// ---------- web_detail ----------

/** 批量插入明细。原 Java 用单条多 VALUES；这里用 D1 batch（每行一条 INSERT）。 */
export async function batchInsertDetails(db: D1Database, details: WebLogDetail[]): Promise<void> {
  if (details.length === 0) return;
  const stmt = db.prepare(
    'INSERT INTO web_detail (task_id,log_type,content,log_time,log_level,add_time,minute_offset) VALUES (?,?,?,?,?,?,?)',
  );
  // D1 batch 单次建议不超过 ~100 行，这里按 50 分批兜底
  const CHUNK = 50;
  for (let i = 0; i < details.length; i += CHUNK) {
    const chunk = details.slice(i, i + CHUNK);
    await db.batch(
      chunk.map((d) =>
        stmt.bind(d.taskId, d.logType, d.content, d.logTime, d.logLevel, d.addTime, d.minuteOffset),
      ),
    );
  }
}

interface WebDetailRow {
  id: number;
  task_id: number;
  log_type: number;
  content: string;
  log_time: number;
  log_level: number | null;
  add_time: number;
  minute_offset: number;
}
function rowToDetail(r: WebDetailRow): WebLogDetail {
  return {
    id: r.id,
    taskId: r.task_id,
    logType: r.log_type,
    content: r.content,
    logTime: r.log_time,
    logLevel: r.log_level ?? 0,
    addTime: r.add_time,
    minuteOffset: r.minute_offset,
  };
}

/** match：task_id + minute_offset 区间 + 可选 log_type IN。keyword 在内存 contains（与 Java 一致）。 */
export async function matchDetails(
  db: D1Database,
  taskId: number,
  beginOffset: number,
  endOffset: number,
  logTypes: number[],
  keyword?: string,
): Promise<WebLogDetail[]> {
  let sql = 'SELECT * FROM web_detail WHERE task_id=? AND minute_offset BETWEEN ? AND ?';
  const binds: (string | number)[] = [taskId, beginOffset, endOffset];
  if (logTypes.length > 0) {
    sql += ` AND log_type IN (${logTypes.map(() => '?').join(',')})`;
    binds.push(...logTypes);
  }
  const { results } = await db.prepare(sql).bind(...binds).all<WebDetailRow>();
  let list = (results ?? []).map(rowToDetail);
  if (keyword && list.length > 0) {
    list = list.filter((d) => d.content.includes(keyword));
  }
  return list;
}

export async function queryDetailsByIds(db: D1Database, ids: number[]): Promise<WebLogDetail[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT * FROM web_detail WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<WebDetailRow>();
  const list = (results ?? []).map(rowToDetail);
  // 按传入 ids 顺序重排（对应 OrderUtil.order）
  return ids
    .map((id) => list.find((d) => d.id === id))
    .filter((d): d is WebLogDetail => d != null);
}

export async function queryDetailById(db: D1Database, id: number): Promise<WebLogDetail | null> {
  const row = await db.prepare('SELECT * FROM web_detail WHERE id=? LIMIT 1').bind(id).first<WebDetailRow>();
  return row ? rowToDetail(row) : null;
}
