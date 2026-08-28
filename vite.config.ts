import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'relax-csp-dev',
      transformIndexHtml(html, ctx) {
        if (ctx.server) {
          return html.replace(
            "default-src 'self'; script-src 'self'; connect-src 'self';",
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ws: wss: http: https:;",
          );
        }
        return html;
      },
    },
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
