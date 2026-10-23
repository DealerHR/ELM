import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// Preview build: swaps the Supabase client for fixtures so screens render offline.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: /^(.*)\/lib\/supabase$/, replacement: path.resolve(__dirname, 'src/__mock_supabase.ts') }] },
});
