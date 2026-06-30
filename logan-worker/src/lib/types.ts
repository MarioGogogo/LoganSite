/**
 * H5 链路用到的类型定义，对应 Java 的 DTO/WebLogFieldEnum/LoganResponse。
 */

/** WebLogFieldEnum —— 客户端上报字段 key */
export const Field = {
  VERSION: 'v',
  LOG: 'l',
  IV: 'iv',
  KEY: 'k',
  LOG_TYPE: 't',
  CONTENT: 'c',
  LOG_TIME: 'd',
} as const;

/** TaskStatusEnum */
export const TaskStatus = {
  NORMAL: 0, // 未解析
  ANALYZED: 1, // 已解析
} as const;

/** web_detail 一行 */
export interface WebLogDetail {
  id: number;
  taskId: number;
  logType: number;
  content: string;
  logTime: number;
  logLevel: number;
  addTime: number;
  minuteOffset: number;
}

/** web_task 一行 */
export interface WebLogTask {
  taskId: number;
  deviceId: string;
  webSource: string;
  environment: string;
  pageNum: number;
  content: string; // 序列化后的日志数组 JSON 字符串，不返回前端
  addTime: number;
  logDate: number;
  status: number;
  customReportInfo: string;
  updateTime: number;
  tasks?: string; // 聚合后的多个 taskId，仅返回前端用
}

/** 详情索引（WebLogIndex），分页返回 */
export interface WebLogIndex {
  detailId: number;
  logType: number;
  logTime: number;
}

/** 统一返回结构（LoganResponse）：code=200 成功，400 参数错，500 异常 */
export interface LoganResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

export const ok = <T>(data: T): LoganResponse<T> => ({ code: 200, data });
export const badParam = (msg: string): LoganResponse<never> => ({ code: 400, msg });
export const exception = (msg: string): LoganResponse<never> => ({ code: 500, msg });
