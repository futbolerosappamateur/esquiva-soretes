import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build se puede abrir desde cualquier subcarpeta de un hosting.
  base: './',
  server: {
    port: 5173,
    // Expone el servidor en la red local para probar desde el celular.
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2020',
    // Phaser ocupa ~1.2 MB minificado; es esperable y no es un error.
    chunkSizeWarningLimit: 1600,
  },
});
