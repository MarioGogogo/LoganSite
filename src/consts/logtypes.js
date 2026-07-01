/**
 * 日志类型配置（数字 → 展示名 + 颜色）。
 *
 * 这是全项目唯一的类型展示事实源。编号必须与上报端枚举一一对应：
 *   logan-reporter/packages/shared/src/LogType.js
 * 编号一旦发布即「冻结」：已分配的值永不复用、永不改含义，只能新增。
 *
 * | 值 | 展示名   | 语义                                   |
 * |----|----------|----------------------------------------|
 * | 1  | 业务日志 | 业务关键节点、自定义打点              |
 * | 2  | 异常日志 | JS 异常、未捕获错误、Promise rejection |
 * | 3  | 网络请求 | 接口请求 / 响应（HTTPS / fetch / XHR） |
 * | 4  | 用户行为 | 点击、路由跳转、曝光                   |
 * | 5  | 生命周期 | 冷启动、页面挂载、前后台切换           |
 * | 6  | 性能日志 | 加载耗时、慢接口、卡顿                 |
 * | 7  | 调试日志 | 临时排查、详细变量                     |
 */
export const logTypeConfigs = [
  {
    logType: 1,
    logTypeName: "业务日志",
    displayColor: "#2f54eb"
  },
  {
    logType: 2,
    logTypeName: "异常日志",
    displayColor: "#f5222d"
  },
  {
    logType: 3,
    logTypeName: "网络请求",
    displayColor: "#52c41a"
  },
  {
    logType: 4,
    logTypeName: "用户行为",
    displayColor: "#fa8c16"
  },
  {
    logType: 5,
    logTypeName: "生命周期",
    displayColor: "#722ed1"
  },
  {
    logType: 6,
    logTypeName: "性能日志",
    displayColor: "#13c2c2"
  },
  {
    logType: 7,
    logTypeName: "调试日志",
    displayColor: "#8c8c8c"
  }
];

// 兼容旧引用：filter-bar 等组件按 native/web 选表。统一一套后两者指向同一份配置。
export const nativeLogTypeConfigs = logTypeConfigs;
export const webLogTypeConfigs = logTypeConfigs;
