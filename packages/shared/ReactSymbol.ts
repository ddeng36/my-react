// check whether current environment supports Symbol
const hasSymbol = typeof Symbol === "function" && Symbol.for;

export const REACT_ELEMENT_TYPE = hasSymbol
  ? Symbol.for("react.element")
  : 0xeac7;

export const REACT_FRAGMENT_TYPE = hasSymbol
  ? Symbol.for("react.fragment")
  : 0xeaca;

export const REACT_CONTEXT_TYPE = hasSymbol
  ? Symbol.for("react.context")
  : 0xeacc;

export const REACT_PROVIDER_TYPE = hasSymbol
  ? Symbol.for("react.provider")
  : 0xeac2;

export const REACT_SUSPENSE_TYPE = hasSymbol
  ? Symbol.for("react.suspense")
  : 0xead1;
