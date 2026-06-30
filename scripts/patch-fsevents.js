/**
 * 禁用 node_modules 中的旧版 fsevents@1.x。
 *
 * 背景：fsevents@1.x 的原生绑定在 Node 17+ 上不可用
 * （运行时报 `fsevents.watch is not a function`），会导致
 * webpack-dev-server 启动后立即崩溃。这里把它的入口改成导出 null，
 * chokidar/watchpack 检测到 fsevents 不可用后会自动回退到轮询模式。
 *
 * 由 package.json 的 postinstall 钩子调用，保证重新安装依赖后修复依然生效。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'fsevents', 'fsevents.js');

if (!fs.existsSync(target)) {
  // fsevents 不存在（例如非 macOS 或已升级），无需处理。
  process.exit(0);
}

const stub =
  '/* patched: fsevents@1.x 与 Node 17+ 不兼容，已禁用以回退轮询 */\n' +
  "module.exports = null;\n";

let current = '';
try {
  current = fs.readFileSync(target, 'utf8');
} catch (e) {
  // 读不到就当作需要 patch
}

if (current.startsWith('/* patched')) {
  // 已经 patch 过，跳过。
  process.exit(0);
}

// 备份原始文件，便于排查。
fs.writeFileSync(target + '.bak', current);
fs.writeFileSync(target, stub + current);
console.log('scripts/patch-fsevents.js: 已禁用旧版 fsevents（回退轮询模式）');
