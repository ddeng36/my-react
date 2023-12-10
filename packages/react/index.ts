// This is to export 'React'
import { jsxDEV, jsx } from "./src/jsx";
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from "./src/currentDispatcher";
import { isValidElement as isValidElementFn } from "./src/jsx";
import currentBatchConfig from "./src/currentBatchConfig";
export { REACT_FRAGMENT_TYPE as Fragment } from "shared/ReactSymbol";
export { REACT_SUSPENSE_TYPE as Suspense } from "shared/ReactSymbol";
export const version = "0.0.0";
export const createElement = jsx;
export { createContext } from "./src/context";
export const isValidElement = isValidElementFn;
export { memo } from "./src/memo";

export const useState: Dispatcher["useState"] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher["useEffect"] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};
export const useTransition: Dispatcher["useTransition"] = () => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
};
export const useRef: Dispatcher["useRef"] = (initialValue) => {
  const dispatcher = resolveDispatcher() as Dispatcher;
  return dispatcher.useRef(initialValue);
};
export const useContext: Dispatcher["useContext"] = (context) => {
  const dispatcher = resolveDispatcher() as Dispatcher;
  return dispatcher.useContext(context);
};
export const use: Dispatcher["use"] = (usable) => {
  const dispatcher = resolveDispatcher() as Dispatcher;
  return dispatcher.use(usable);
};
export const useMemo: Dispatcher["useMemo"] = (nextCreate, deps) => {
  const dispatcher = resolveDispatcher() as Dispatcher;
  return dispatcher.useMemo(nextCreate, deps);
};

export const useCallback: Dispatcher["useCallback"] = (callback, deps) => {
  const dispatcher = resolveDispatcher() as Dispatcher;
  return dispatcher.useCallback(callback, deps);
};
// internal data sharing layer between React and ReactDOM
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig,
};
