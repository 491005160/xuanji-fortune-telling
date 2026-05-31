# 天机 - 传统命理推演系统

一个基于 Vite、React 和 Gemini API 的命理推演 Web 应用，包含八字称骨、星座运势、塔罗问答和报告长图导出。

## 本地运行

**前置要求：** Node.js

1. 安装依赖：

   ```bash
   npm install
   ```

2. 复制环境变量：

   ```bash
   cp .env.example .env.local
   ```

3. 在 `.env.local` 中填写：

   ```bash
   GEMINI_API_KEY="你的 Gemini API Key"
   GEMINI_MODEL="gemini-2.5-flash"
   ```

4. 启动开发服务：

   ```bash
   npm run dev
   ```

> 注意：普通 `vite` 开发服务不会自动运行 Vercel API Route。需要完整测试 `/api/gemini` 时，建议使用 Vercel 部署预览，或本地安装 Vercel CLI 后运行 `vercel dev`。

## 部署建议

推荐使用 GitHub + Vercel：

1. 把项目推送到 GitHub。
2. 在 Vercel 导入该 GitHub 仓库。
3. 在 Vercel 项目设置里添加环境变量：
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`，可选，默认是 `gemini-2.5-flash`
4. 部署。

## 安全说明

Gemini API Key 只应保存在服务端环境变量中。项目已通过 `api/gemini.ts` 代理 Gemini 请求，前端不会直接打包 `GEMINI_API_KEY`。

请不要提交 `.env.local`、`.env` 或任何真实密钥文件。

## 常用命令

```bash
npm run lint
npm run build
npm run preview
npm run clean
```
