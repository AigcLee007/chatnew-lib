import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 生产构建由 /main/ 子路径提供；开发服务器仍从根路径运行。
      base: mode === 'production' ? '/main/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            timeout: 300000,
            proxyTimeout: 300000
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // --- 关键修改：开启 ESNext 支持，防止 PDF.js 报错 ---
      build: {
        target: 'esnext', 
        chunkSizeWarningLimit: 1500 // 调大警告阈值，因为我们现在把解析库打包进来了
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext'
        }
      }
    };
});
