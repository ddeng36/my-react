import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import replace from "@rollup/plugin-replace";
import { getPckPath } from "../rollup/utils";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    replace({
      __DEV__: true,
      preventAssignment: true,
    }),
  ],
  resolve: {
    alias: [
      {
        find: "react",
        replacement: getPckPath("react"),
      },
      {
        find: "react-dom",
        replacement: getPckPath("react-dom"),
      },
      {
        find: "react-reconciler",
        replacement: getPckPath("react-reconciler"),
      },
      {
        find: "react-noop-renderer",
        replacement: getPckPath("react-noop-renderer"),
      },
      {
        find: "hostConfig",
        replacement: path.resolve(
          getPckPath("react-dom"),
          "./src/hostConfig.ts"
        ),
      },
      //[vite] Internal server error: Failed to resolve import "shared/ReactSymbol" from "packages/react-reconciler/src/fiber.ts". Does the file exist?
      {
        find: "shared",
        replacement: path.resolve(
          getPckPath("shared"),
        ),
      }
    ],
  },
});
