import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api/vehicle_positions': {
        target: 'https://gtfsrt.renfe.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/vehicle_positions.json',
      },
    },
  },
});
