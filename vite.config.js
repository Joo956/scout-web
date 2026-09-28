import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy vendor libraries split into separate chunks
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-exceljs': ['exceljs'],
        },
      },
    },
  },
});
