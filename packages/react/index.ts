// This is to export 'React'
import { jsxDEV, jsx } from "./src/jsx";
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from "./src/currentDispatcher";
import { isValidElement as isValidElementFn } from "./src/jsx";
export const version = "0.0.0";
export const createElement = jsx;
export const isValidElement = isValidElementFn;
export { REACT_FRAGMENT_TYPE as Fragment } from 'shared/ReactSymbols';
export const useState: Dispatcher["useState"] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

// internal data sharing layer between React and ReactDOM
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
};
