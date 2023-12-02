import { getPckJSON, getPckPath, getBaseRollupPlugin } from "./utils";
import generatePackageJson from "rollup-plugin-generate-package-json";
import alias from "@rollup/plugin-alias";

const { name, module } = getPckJSON("react-noop-renderer");
// react-dom包的路径
const pkgPath = getPckPath(name);
// react-dom产物路径
const pkgDistPath = getPckPath(name, true);

export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: "ReactNoopRenderer",
        format: "umd",
      },
    ],
    external: [...Object.keys("workspace:*"), "scheduler"],
    plugins: [
      ...getBaseRollupPlugin({
        typescript: {
          exclude: ["./packages/react-dom/**/*"],
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`],
              },
            },
          },
        },
      }),
      // webpack resolve alias
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`,
        },
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version,
          },
          main: "index.js",
        }),
      }),
    ],
  },
];
