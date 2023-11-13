import { getPckPath, getPckJSON } from "./utils.js";
import { getBaseRollupPlugin } from "./utils.js";
import  generatePackageJson  from "rollup-plugin-generate-package-json";

// get the name of package from its' package.json file
const { name, module } = getPckJSON("react");
// get the package path of the specified package name.
const pckPath = getPckPath(name);
// get the dist package path of the specified package name.
const pckDistPath = getPckPath(name, true);

export default [
  {
    // react
    input: `${pckPath}/${module}`,
    output: {
      file: `${pckDistPath}/index.js`,
      name: "index.js",
      format: "umd",
    },

    plugins: [
      ...getBaseRollupPlugin(),
      generatePackageJson({
        inputFolder: pckPath,
        outputFolder: pckDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: 'index.js',
        }),
      }),
    ],
  },
  {
    // jsx-runtime
    input: `${pckPath}/src/jsx.ts`,
    output: [
      //jsx runtime
      {
        file: `${pckDistPath}/jsx-runtime.js`,
        name: "jsx-runtime.js",
        format: "umd",
      },
      //jsx dev runtime
      {
        file: `${pckDistPath}/jsx-dev-runtime.js`,
        name: "jsx-dev-runtime.js",
        format: "umd",
      },
    ],

    plugins: getBaseRollupPlugin(),
  },
];
