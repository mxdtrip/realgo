import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const deckRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(
  process.env.REALGO_EXTENSION_ROOT || path.join(deckRoot, "../extension"),
);
const { defineConfig } = await import(
  pathToFileURL(path.join(extensionRoot, "node_modules/vite/dist/node/index.js")).href
);
export default defineConfig({
  root: deckRoot,
  define: { "process.env.NODE_ENV": '"production"' },
  esbuild: { jsxInject: 'import React from "react"' },
  resolve: { alias: {
    "@realgo-extension": path.join(extensionRoot, "src"),
    react: path.join(extensionRoot, "node_modules/react"),
    "react-dom": path.join(extensionRoot, "node_modules/react-dom"),
  } },
  build: {
    emptyOutDir: false, assetsInlineLimit: 1_000_000,
    lib: { entry: path.join(deckRoot, "product-ui-source.tsx"), formats: ["es"], fileName: () => "product-ui.js" },
    outDir: path.join(deckRoot, "assets"),
    rollupOptions: { output: { assetFileNames: "product-ui-[name][extname]" } },
  },
});
