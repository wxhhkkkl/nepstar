# 长寿指数报告 V2

本目录是当前唯一维护的报告前端，已迁移为 Vue 3 + JavaScript + Vue Router + Vite。

唯一维护路径：`reportFront/report-v2/`。目录改名不影响页面路由和访问端口。

迁移前的原生 V2 文件已归档到 `code_v1/`，仅用于对照和恢复，不参与当前 Vue 构建。

## 环境

- Node.js：`^22.18.0 || >=24.12.0`（本次验证使用 24.19.0）
- 不使用 TypeScript、Pinia、Axios 或 UI 组件库
- 本阶段只读取 `src/data/report.js` 中的模拟数据，不请求后台 API

旧版 KH503 使用自己的 Node 环境，不要为运行本目录修改 KH503。

## 启动

```bash
cd /Users/leelee/Desktop/体检报告/nepstar/reportFront/report-v2
nvm use
npm install
npm run dev -- --host 0.0.0.0
```

如果当前终端仍是旧项目使用的 Node 12，可直接用本机 Codex 提供的现代 Node 启动：

```bash
/Users/leelee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js --host 0.0.0.0
```

Vite 会显示本机和局域网地址。主要路由：

- `/#/`：报告首页
- `/#/system/endocrine`：内分泌详情
- `/#/system/bone`：骨骼详情
- `/detail.html?id=<systemId>`：旧地址兼容跳转

## 验证

```bash
npm run test
npm run test:e2e
npm run build
npm run preview -- --host 0.0.0.0
```

启动开发或预览服务后，可运行 `npm run render` 生成首页验收长图。

## 维护边界

本次迁移只维护本目录。不得把改动同步到 `reportFront/baogaoV2`、V3、旧版 `reportFront/长寿指数UI设计`、KH503 或管理后台。
