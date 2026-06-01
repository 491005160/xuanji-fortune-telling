# 天机 - 传统命理推演系统

一个基于 Vite、React 和服务端 AI 代理的命理推演 Web 应用，包含八字称骨、星座运势、塔罗问答和报告长图导出。

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
   AI_PROVIDER="siliconflow"
   AI_BASE_URL="https://api.siliconflow.cn/v1"
   AI_MODEL="deepseek-ai/DeepSeek-V4-Flash"
   AI_API_KEY="你的 SiliconFlow API Key"
   ```

4. 启动开发服务：

   ```bash
   npm run dev
   ```

> 注意：普通 `vite` 开发服务只运行前端。需要完整测试前端和 `/api/gemini` 时，先执行 `npm run build`，再执行 `npm start`。

## 部署建议

### Vercel

1. 把项目推送到 GitHub。
2. 在 Vercel 导入该 GitHub 仓库。
3. 在 Vercel 项目设置里添加环境变量：
   - `AI_PROVIDER`
   - `AI_BASE_URL`
   - `AI_MODEL`
   - `AI_API_KEY`
4. 部署。

### Zeabur

Zeabur 可以按普通 Node.js 服务部署本项目：

1. 在 Zeabur 从 GitHub 导入该仓库。
2. 环境变量添加：
   - `AI_PROVIDER=siliconflow`
   - `AI_BASE_URL=https://api.siliconflow.cn/v1`
   - `AI_MODEL=deepseek-ai/DeepSeek-V4-Flash`
   - `AI_API_KEY=你的 SiliconFlow API Key`
3. Build Command 使用 `npm run build`。
4. Start Command 使用 `npm start`。
5. Zeabur 会通过 `PORT` 环境变量注入端口，服务会自动读取。

## 安全说明

AI API Key 只应保存在服务端环境变量中。项目已通过 `/api/gemini` 代理 AI 请求，前端不会直接打包密钥。

请不要提交 `.env.local`、`.env` 或任何真实密钥文件。

## 常用命令

```bash
npm run lint
npm run build
npm start
npm run preview
npm run clean
```
