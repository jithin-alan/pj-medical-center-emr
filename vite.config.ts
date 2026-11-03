import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.webmanifest',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'PJ Medical Clinic Management System',
          short_name: 'PJ Clinic',
          description: 'Clinic operations, patient workflow, pharmacy and billing.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f8fafc',
          theme_color: '#0d9488',
          icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
          runtimeCaching: [{
            urlPattern: /\/api\/state$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'clinic-state', networkTimeoutSeconds: 4 },
          }],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
