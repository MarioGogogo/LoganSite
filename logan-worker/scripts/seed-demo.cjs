/**
 * 灌入演示用的 H5 明文日志，方便在 LoganSite 前端 /web-list 页面查看效果。
 * 造 2 个设备、每个设备多条不同类型日志（v=0 明文，无需加密）。
 *
 * 用法: node scripts/seed-demo.cjs [backendUrl]
 */
const http = require('http');

const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const DAY = '2026-06-30';

function buildLogArray(items) {
  // items: [{t, c}]，每项 base64 编码后包成 {v:0,l}
  return items
    .map((it) => {
      const plain = JSON.stringify({ t: it.t, c: it.c, d: it.d ?? Date.now() });
      const b64 = Buffer.from(plain).toString('base64');
      return encodeURIComponent(JSON.stringify({ v: 0, l: b64 }));
    })
    .join(',');
}

function upload(deviceId, pageNo, items) {
  const body = JSON.stringify({
    deviceId,
    logPageNo: pageNo,
    fileDate: DAY,
    logArray: buildLogArray(items),
  });
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + '/logan/web/upload.json');
    const req = http.request(
      {
        method: 'POST',
        host: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(JSON.parse(data)));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const now = Date.now();
const devices = [
  {
    id: 'web-chrome-001',
    source: 'chrome',
    logs: [
      { t: 1, c: '[INFO] 页面加载完成，耗时 320ms', d: now - 3600_000 },
      { t: 2, c: '[ERROR] 接口 /api/order 返回 500', d: now - 3500_000 },
      { t: 1, c: '[INFO] 用户点击「提交订单」按钮', d: now - 3400_000 },
      { t: 3, c: '[WARN] 内存使用率 78%，接近阈值', d: now - 3300_000 },
      { t: 1, c: '[INFO] WebSocket 已连接', d: now - 3200_000 },
    ],
  },
  {
    id: 'web-safari-002',
    source: 'safari',
    logs: [
      { t: 1, c: '[INFO] 首屏渲染完成', d: now - 7200_000 },
      { t: 2, c: '[ERROR] 资源加载失败：main.chunk.js', d: now - 7100_000 },
      { t: 4, c: '[NETWORK] 请求耗时 1.2s，状态 200', d: now - 7000_000 },
      { t: 1, c: '[INFO] 用户登出', d: now - 6900_000 },
    ],
  },
];

(async () => {
  for (const dev of devices) {
    const res = await upload(dev.id, 1, dev.logs);
    console.log(`${dev.id}: ${JSON.stringify(res)}`);
  }
  console.log('\n完成。打开前端 /web-list 页面查看：');
  console.log('  http://localhost:3000/web-list');
})();
