import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", globals: true, include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": __dir } },
});
