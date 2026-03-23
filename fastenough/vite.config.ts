import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-health-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/health', (req, res, next) => {
          if (req.method !== 'GET') {
            return next();
          }

          const payload = {
            ok: true,
            service: 'fastenough',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '0.0.0',
            environment: process.env.NODE_ENV || 'development',
          };

          res.statusCode = 200;
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        });
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
