import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// 这一行以前顶着 `// @ts-expect-error type error without @types/node package`：批次 1 装好
// `@types/node` 之后那个抑制指令**失效**了，留着它 `npx tsc -p tsconfig.node.json --noEmit`
// 会报 TS2578（Unused '@ts-expect-error' directive）——4-2 的 S-05。抑制指令过期 = 关于仓库状态的错误陈述。
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
