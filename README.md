# Logan Site

Logan 日志系统的 Web 端：包含**前端管理后台**（LoganSite）与**后端服务**（logan-worker，部署在 Cloudflare）。

> Logan 是美团开源的移动端基础日志库。本项目提供对 App / H5 上报日志的浏览、检索、详情查看等功能。
> 关于 Logan 本身：[美团技术博客](https://tech.meituan.com/2018/10/11/logan-open-source.html)

---

## 仓库结构（monorepo）

```
LoganSite/
├── src/                 # ① 前端 LoganSite（CRA eject，React 16 + antd 3）
├── config/              #    前端 webpack 配置
├── public/              #    前端静态资源
├── package.json         #    前端依赖与脚本
│
├── logan-worker/        # ② 后端（Cloudflare Workers + Hono + D1）
│   ├── src/             #    H5 日志链路 9 个接口
│   ├── scripts/         #    联调/灌数据脚本
│   ├── schema.sql       #    D1 建表
│   ├── wrangler.toml    #    Workers 配置
│   └── README.md        #    后端详细文档
│
├── README_CN.md         # 前端原版说明（中文）
└── README_orig_en.md    # 前端原版说明（英文）
```

**两个子项目各自独立**：各有自己的 `package.json` 和依赖，互不影响。前端通过 HTTP API 调用后端。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 16 + React Router 5 + Redux + antd 3 + Konva（MiniMap） |
| 后端 | Cloudflare Workers + [Hono](https://hono.dev/) + D1 (SQLite) + Web Crypto |
| 部署 | 后端部署在 Cloudflare 边缘；前端可本地 dev 或自行部署 |

---

## 快速开始（本地全套联调）

### 前置
- Node.js 18+（推荐 20）
- 一个 Cloudflare 账号（仅部署后端时需要）

### 第 1 步：启动后端（端口 8787）

```bash
cd logan-worker
npm install
npm run db:init     # 初始化本地 D1 数据库
npm run dev         # 启动本地 Workers dev server → http://localhost:8787
```

### 第 2 步：启动前端（端口 3000）

回到仓库根目录：

```bash
cd ..               # 回到 LoganSite/
npm install
npm run start       # 启动前端 → http://localhost:3000
```

### 第 3 步：浏览器访问

前端默认进的是原生日志页（`/native-list`，该链路后端尚未实现，会显示空）。
**H5 日志数据在 `/web-list`**：

```
http://localhost:3000/web-list
```

### 想要演示数据？

后端跑起来后，灌一批 H5 明文日志，方便在 UI 里查看：

```bash
cd logan-worker
node scripts/seed-demo.cjs http://localhost:8787
```

---

## 前后端如何对接

前端通过 `src/common/api.js` 里的 `API_BASE_URL` 指向后端，值来自环境变量文件 `.env.development`：

```bash
# 本地联调（默认）
API_BASE_URL=http://localhost:8787

# 线上后端
API_BASE_URL=https://logan-worker.jerrychen239355.workers.dev
```

> ⚠️ 修改 `.env.development` 后需**重启前端** dev server 才生效（webpack 在启动时注入环境变量）。

---

## 部署后端到 Cloudflare

详见 [logan-worker/README.md](./logan-worker/README.md)，核心步骤：

```bash
cd logan-worker
npx wrangler login                              # 登录 Cloudflare
npx wrangler d1 create logan-db                 # 创建数据库（把返回的 id 填进 wrangler.toml）
npm run db:init:remote                          # 线上建表
npx wrangler secret put H5_RSA_PRIVATE_KEY      # 注入 RSA 私钥
npm run deploy                                  # 部署
```

部署后把前端 `.env.development` 的 `API_BASE_URL` 改成你的 Worker 地址即可。

---

## 已实现 / 待办

| 链路 | 状态 | 说明 |
|---|---|---|
| H5 日志 - 明文 (v=0) | ✅ 完整可用 | 上报/查询/详情/搜索/下载 |
| H5 日志 - 加密 (v=1) | ⚠️ 待调通 | 服务端 RSA 解密卡在 Workers Web Crypto 算法名 |
| App 原生日志 | ❌ 未实现 | 需 R2 存储 + 二进制协议 + AES/CBC + GZIP |

---

## 项目脚本速查

**前端**（仓库根目录）：
| 命令 | 作用 |
|---|---|
| `npm run start` | 启动前端 dev server（3000） |
| `npm run build` | 生产构建 |
| `npm run test` | 单元测试 |

**后端**（`logan-worker/`）：
| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动 Workers dev server（8787） |
| `npm run db:init` | 本地 D1 建表 |
| `npm run db:init:remote` | 线上 D1 建表 |
| `npm run deploy` | 部署到 Cloudflare |

---

## 关于 Node 版本

前端是基于 CRA eject 的老项目（React 16 / node-sass / webpack 4），已做适配可在 **Node 20** 下运行：
- `node-sass` 替换为 Dart `sass`
- 通过 postinstall 脚本 patch 旧版 fsevents
- start 脚本内嵌 `--openssl-legacy-provider`

详见 [前端适配说明](#)（`scripts/patch-fsevents.js` 内有注释）。

---

## License
MIT（沿用 Logan 开源协议）
