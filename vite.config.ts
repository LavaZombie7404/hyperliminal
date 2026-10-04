import { defineConfig } from 'vite';

export default defineConfig({
  base: '/hyperliminal/',
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
    },
  },
});
