import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // `@core/...`, `@game/...` etc. come from `paths` in tsconfig.json.
    tsconfigPaths: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: true,
  }
});
