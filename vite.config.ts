import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applyServerEnv } from './server/ai/deepseekConfig';
import { cotraceApiPlugin } from './server/viteApiPlugin';

export default defineConfig(({ mode }) => {
  // 配置阶段即显式加载服务端环境（含 .env.local 的 DEEPSEEK_*），
  // 不依赖 VITE_ 前缀，也不会把密钥暴露给浏览器包。
  const loaded = loadEnv(mode, process.cwd(), '');
  applyServerEnv(loaded);

  return {
    // GitHub Pages 子路径用 VITE_BASE=/CoTrace_DEMO/；本地/Vercel 保持 /
    base: process.env.VITE_BASE || '/',
    plugins: [react(), cotraceApiPlugin()],
    // 保持默认 envPrefix=VITE_，禁止客户端读取 DEEPSEEK_*。
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      open: false,
    },
  };
});
