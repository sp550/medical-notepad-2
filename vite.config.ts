import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron"; // Use the standard plugin
import renderer from "vite-plugin-electron-renderer"; // Use the renderer plugin
import path from "node:path"; // Ensure path is imported
import pkg from "./package.json"; // Keep if you use it for externals

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  const sourcemap = command === "serve" || !!process.env.VSCODE_DEBUG;

  // No need to manually delete dist-electron here usually

  return {
    optimizeDeps: {
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"), // Keep the alias
      },
    },
    plugins: [
      vue(),
      monacoEditorPlugin({
      }),
      electron([
        // Configure main and preload processes
        {
          // Main-Process entry file of the Electron App.
          entry: "electron/main.ts", // Your main entry
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: "dist-electron/", // Main output dir
              rollupOptions: {
                external: Object.keys(
                  "dependencies" in pkg ? pkg.dependencies : {}
                ),
              },
            },
            // Optional: Add onstart for debugging as you had before
          },
        },
        {
          entry: "electron/preload.ts", // Your preload entry
          onstart(options) {
            // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
            // instead of restarting the entire Electron App.
            options.reload();
          },
          vite: {
            build: {
              sourcemap: sourcemap ? "inline" : undefined,
              minify: isBuild,
              outDir: "dist-electron/", // Preload output dir
              rollupOptions: {
                external: Object.keys(
                  "dependencies" in pkg ? pkg.dependencies : {}
                ),
                output: {
                  // Ensure monaco editor assets are handled correctly
                  manualChunks: {
                    "monaco-editor": ["monaco-editor"],
                  },
                },
              },
            },
          },
        },
      ]),
      renderer(),
    ],
    // Optional: Keep server config for debugging
    server:
      process.env.VSCODE_DEBUG &&
      (() => {
        if (pkg.debug?.env?.VITE_DEV_SERVER_URL) {
          try {
            const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
            return { host: url.hostname, port: +url.port };
          } catch (e) {
            console.error("Error parsing VITE_DEV_SERVER_URL:", e);
            return undefined;
          }
        }
        return undefined;
      })(),
    clearScreen: false,
    fs: {
      allow: [path.resolve(__dirname, "node_modules/monaco-editor")],
    },
  };
});
