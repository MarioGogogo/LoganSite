-- Logan H5 链路 D1 (SQLite) schema
-- 由 MySQL 迁移而来。主要类型映射：
--   bigint/text/mediumtext -> INTEGER / TEXT
--   timestamp(默认 CURRENT_TIMESTAMP) -> INTEGER(存毫秒)，由应用层写入
--   AUTO_INCREMENT -> INTEGER PRIMARY KEY AUTOINCREMENT

-- H5 上报任务表（对应原 web_task）
CREATE TABLE IF NOT EXISTS web_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL DEFAULT '',
  web_source TEXT,
  environment TEXT,
  page_num INTEGER NOT NULL,
  content TEXT NOT NULL,
  add_time INTEGER NOT NULL,
  log_date INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,  -- 0 未解析, 1 已解析
  custom_report_info TEXT,
  update_time INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_web_task_log_date_deviceid ON web_task (log_date, device_id);
CREATE INDEX IF NOT EXISTS idx_web_task_add_time_deviceid ON web_task (add_time, device_id);

-- H5 日志详情表（对应原 web_detail）
CREATE TABLE IF NOT EXISTS web_detail (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  log_type INTEGER NOT NULL,
  content TEXT NOT NULL,
  log_time INTEGER NOT NULL,
  log_level INTEGER,
  add_time INTEGER NOT NULL,
  minute_offset INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_web_detail_taskid_logtype ON web_detail (task_id, log_type);
