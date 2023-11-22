// This is to export 'React'
import { jsxDEV } from "./src/jsx";

export default {
    version: "0.0.0",
    // Here in our version of React, createElement , jsx, jexDEV are same.
    // But in React, they are different.
    createElement: jsxDEV
};