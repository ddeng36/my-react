// const path = require('path');
// const fs = require('fs');
import path from "path";
import fs from "fs";
import ts from "rollup-plugin-typescript2";
import cjs from '@rollup/plugin-commonjs'

// Note that __dirname is the directory of the current file, it is global variable.
const pkgPath = path.resolve(__dirname, "../../packages");
const distPath = path.resolve(__dirname, "../../dist/node_modules");

// Get the package path of the specified package name.
export const getPckPath = function (pckName, isDist) {
  return `${isDist ? distPath : pkgPath}/${pckName}`;
};

// Get the package.json of the specified package name.
export const getPckJSON = function (pckName) {
  const path = getPckPath(pckName) + "/package.json";
  const str = fs.readFileSync(path, { encoding: "utf-8" });
  return JSON.parse(str);
};

export const getBaseRollupPlugin = function (typescript) {
  return [ts(typescript), cjs()];
};
