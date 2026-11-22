import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  // Rutas relativas: el build se puede abrir desde cualquier subcarpeta de un hosting.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
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
    // Phaser ocupa ~1.2 MB minificado; es esperable y no es un error. (La librería de Supabase
    // va en un archivo aparte que sólo se descarga si el modo online está configurado.)
    chunkSizeWarningLimit: 1700,
  },
});
