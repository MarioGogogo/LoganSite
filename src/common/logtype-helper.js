import { logTypeConfigs } from "../consts/logtypes";

// 未知类型的兜底配置（logType 落库为 0 或查不到时使用）。
const UNKNOWN_LOG_TYPE_CONFIG = {
  logType: 0,
  logTypeName: "未知日志",
  displayColor: "#000000"
};

/**
 * 按 logType 数字查展示配置（名称 + 颜色）。
 * native / web 现共用同一份 logTypeConfigs，故不再区分 type 参数。
 * 找不到时回退到「未知日志」（黑色），与历史行为一致。
 * @param {number} logType
 * @returns {{ logType: number, logTypeName: string, displayColor: string }}
 */
export const getLogTypeConfig = logType => {
  const rule = logTypeConfigs.find(item => item.logType === logType);
  return rule === undefined ? UNKNOWN_LOG_TYPE_CONFIG : rule;
};
