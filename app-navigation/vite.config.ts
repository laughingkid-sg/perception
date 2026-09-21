import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: 'src/main.tsx',
      formats: ['es'],
      fileName: () => 'app-navigation.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'app-navigation.[ext]',
      },
    },
  },
});
