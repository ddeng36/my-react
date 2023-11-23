import { getPckPath, getPckJSON,getBaseRollupPlugin} from "./utils.js";
import generatePackageJson from "rollup-plugin-generate-package-json";
import alias from '@rollup/plugin-alias';
// get the name of package from its' package.json file
const { name, module } = getPckJSON("react-dom");
// get the package path of the specified package name.
const pckPath = getPckPath(name);
// get the dist package path of the specified package name.
const pckDistPath = getPckPath(name, true);

export default [
  {
    // react-dom
    input: `${pckPath}/${module}`,
    output: [
      {
        file: `${pckDistPath}/index.js`,
        name: "index.js",
        format: "umd",
      },
      {
        file: `${pckDistPath}/client.js`,
        name: "client.js",
        format: "umd",
      },
    ],
    plugins: [
      ...getBaseRollupPlugin(),
      alias({
        entries:{
          hostConfig: `${pckPath}/src/HostConfig.ts`,
        }
      }),
      generatePackageJson({
        inputFolder: pckPath,
        outputFolder: pckDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies:{
            react: version
          },
          main: "index.js",
        }),
      }),
    ],
  },
];
