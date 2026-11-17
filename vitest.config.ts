import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // the '' prefix loads ALL variables from .env, not just VITE_ ones
    env: loadEnv(mode, process.cwd(), ''),
    fileParallelism: false,
  },
}));