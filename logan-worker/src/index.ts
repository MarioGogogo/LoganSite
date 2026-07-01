import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { webRouter, type Env } from './routes/web';

const app = new Hono<{ Bindings: Env }>();

// CORS（对应 Java CORSFilter @CrossOrigin(origins="*")）。
// 前端 axios 带 withCredentials:true，浏览器禁止 Allow-Origin 用 "*"，
// 因此改为回显请求方 origin，并显式 Allow-Credentials。
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    maxAge: 3600,
  }),
);

// H5 链路
app.route('/', webRouter);

// 健康检查
app.get('/', (c) => c.json({ ok: true, service: 'logan-worker', stage: 'h5' }));

export default app;
