# Logan Worker

Logan 后端的 Cloudflare Workers 重写版（H5/Web 日志链路）。

把原 Java 项目 [Logan-Server](https://github.com/Meituan-Dianping/Logan)（Spring MVC + MyBESIS + MySQL）中的 **H5/Web 日志**这条链路，用 **Cloudflare Workers + Hono + D1 + Web Crypto** 重写，部署到 Cloudflare 边缘。

> 原生日志（App native）链路暂未实现（依赖 R2 + 二进制协议），后续阶段补充。

---

## 技术栈与映射

| 原 Java | Cloudflare | 说明 |
|---|---|---|
| Tomcat + Servlet | Workers 运行时 | `fetch` handler |
| Spring MVC Controller | [Hono](https://hono.dev/) 路由 | 9 个接口，路径完全一致 |
| MySQL + MyBatis | D1 (SQLite) | 单表 CRUD，无 join |
| 本地磁盘 `./logfile/` | （H5 链路不需要） | H5 内容存 DB |
| BouncyCastle RSA/AES | Web Crypto `subtle` | v=1 解密（待完成） |
| `secure.properties` 私钥 | Workers Secret / `.dev.vars` | |
| 长驻线程攒批 | 删除，改同步 `db.batch()` | Workers 无长驻进程 |
| `CORSFilter @CrossOrigin("*")` | `hono/cors` | 支持前端带凭证跨域 |

---

## 目录结构

```
logan-worker/
├── src/
│   ├── index.ts          # 入口：CORS + 挂载路由 + 健康检查
│   ├── routes/web.ts     # 9 个 H5 接口 + 业务编排（懒解析/聚合/分页）
│   └── lib/
│       ├── types.ts      # 类型 + 统一响应（ok/badParam/exception）
│       ├── crypto.ts     # RSA + AES/CTR 解密（v=1，待调通）
│       ├── parser.ts     # logArray 解析 + 明细解析 + minute_offset
│       └── db.ts         # D1 数据访问
├── scripts/
│   ├── gen-h5-payload.cjs  # 模拟客户端生成 v=1 加密上报（联调用）
│   └── seed-demo.cjs       # 灌入演示 H5 明文日志
├── schema.sql            # D1 建表（web_task / web_detail）
├── wrangler.toml         # Workers 配置（D1 绑定）
├── .dev.vars             # 本地 secret（不提交，见 .gitignore）
├── .gitignore
├── tsconfig.json
└── package.json
```

---

## 接口列表（路径与原 Java 后端完全一致）

| Method | 路径 | 功能 |
|---|---|---|
| POST | `/logan/web/upload.json` | H5 上报日志（v=0 明文 / v=1 加密） |
| GET  | `/logan/web/search.json` | 按 deviceId + 时间搜索 |
| GET  | `/logan/web/latest.json` | 最近上报（按 logDate/deviceId 聚合 + 分页） |
| GET  | `/logan/web/detailIndex.json` | 详情索引（首次触发懒解析入库） |
| GET  | `/logan/web/taskDetail.json` | 单次上报信息 |
| GET  | `/logan/web/details.json` | 批量详情 |
| GET  | `/logan/web/logDetail.json` | 单条详情 |
| GET  | `/logan/web/getDownLoadUrl.json` | 生成下载地址 |
| GET  | `/logan/web/download.json` | 下载原始内容 |

返回结构统一为 `{ code, msg?, data? }`（code: 200 成功 / 400 参数错 / 500 异常）。

---

## 快速开始（本地开发）

### 前置
- Node.js 18+（建议 20）
- 已安装项目依赖：`npm install`

### 步骤

```bash
cd logan-worker

# 1. 初始化本地 D1 数据库（建表）
npm run db:init

# 2. 启动本地 Workers dev server（默认 8787 端口）
npm run dev
```

启动后访问 http://localhost:8787/ 应返回 `{"ok":true,"service":"logan-worker","stage":"h5"}`。

`.dev.vars` 已内置一对本地测试用的 RSA 密钥，明文（v=0）链路开箱即用。

---

## 测试

### 1. 手测读接口

```bash
B=http://localhost:8787
curl "$B/"                          # 健康检查
curl "$B/logan/web/latest.json"     # 最近上报
```

### 2. 灌入演示数据（推荐）

```bash
node scripts/seed-demo.cjs http://localhost:8787
```
造 2 个设备、多种日志类型的明文日志，方便在 UI 里查看。

### 3. 端到端验证（curl）

```bash
B=http://localhost:8787

# 上报一条 v=0 明文日志
ITEM=$(node -e "console.log(encodeURIComponent(JSON.stringify({v:0,l:Buffer.from('{\"t\":1,\"c\":\"hi\",\"d\":'+Date.now()+'}').toString('base64')}))))")
curl -X POST $B/logan/web/upload.json -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"t1\",\"logPageNo\":1,\"fileDate\":\"2026-06-30\",\"logArray\":\"$ITEM\"}"

# 查最近 → 拿到 tasks
curl "$B/logan/web/latest.json"

# 用 tasks 触发懒解析并取详情索引
curl "$B/logan/web/detailIndex.json?tasks=<上面拿到的tasks>"

# 用 detailId 取明文
curl "$B/logan/web/logDetail.json?detailId=<上面拿到的detailId>"
```

### 4. 配合前端 LoganSite 联调

前端项目根目录的 `.env.development` 设为：
```
API_BASE_URL=http://localhost:8787
```
启动前端后访问 **H5 日志页**（注意不是默认的原生日志页）：
```
http://localhost:3000/web-list
```

---

## 部署到 Cloudflare

```bash
cd logan-worker

# 1. 登录 Cloudflare（首次）
npx wrangler login

# 2. 创建 D1 数据库，把返回的 database_id 填进 wrangler.toml
npx wrangler d1 create logan-db

# 3. 线上建表
npm run db:init:remote

# 4. 注入生产 RSA 私钥（生产务必换成自己的密钥对！）
npx wrangler secret put H5_RSA_PRIVATE_KEY

# 5. 部署
npm run deploy
```

部署后把前端 `API_BASE_URL` 改成 Worker 地址：
```
API_BASE_URL=https://logan-worker.<你的子域>.workers.dev
```

---

## npm 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地 dev server（端口 8787） |
| `npm run db:init` | 本地 D1 建表 |
| `npm run db:init:remote` | 线上 D1 建表 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm run cf-login` | wrangler 登录 |

---

## 已知限制 / 后续工作

- **v=1 加密链路未通**：服务端 RSA 解密卡在 Workers Web Crypto 的算法名识别（不认 `RSA-PKCS1` / `RSAES-PKCS1-v1_5`），需进一步确认 Workers 准确算法标识。**v=0 明文链路完全可用**。
- **App 原生日志链路未实现**：需要 R2 对象存储 + 自定义二进制协议解析 + AES/CBC + GZIP，是第二阶段工作。
- **原 Java 项目的 demo RSA 私钥非法**（ASN1 结构损坏），本地联调已换成真实生成的密钥对；生产部署前务必生成自己的密钥对，公钥给 H5 SDK，私钥用 `wrangler secret put` 注入。

---

## License
MIT（沿用 Logan 开源协议）
