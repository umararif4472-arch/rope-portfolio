import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  /**
   * Base path. '/' for Firebase Hosting / Vercel / Netlify (they serve at
   * the domain root). The optional GitHub Pages workflow builds with
   * VITE_BASE=/rope-portfolio/ because project sites live under /<repo>/.
   */
  base: process.env.VITE_BASE ?? '/',
});
