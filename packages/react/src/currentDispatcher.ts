import { Action, ReactContext, Usable } from "shared/ReactTypes";
import { HookDeps } from "react-reconciler/src/fiberHooks";

export interface Dispatcher {
  useState: <T>(initialState: () => T | T) => [T, Dispatch<T>];
  useEffect: (callback: () => void | void, deps: HookDeps | undefined) => void;
  useTransition: () => [boolean, (callback: () => void) => void];
  useRef: <T>(initialValue: T) => { current: T };
  useContext: <T>(context: ReactContext<T>) => T;
  use: <T>(usable: Usable<T>) => T;
  useMemo: <T>(nextCreate: () => T, deps: HookDeps | undefined) => T;
  useCallback: <T>(callback: T, deps: HookDeps | undefined) => T;
}

export type Dispatch<State> = (action: Action<State>) => void;

//every time useState is called, it will call resolveDispatcher to get the current dispatcher
const currentDispatcher: { current: Dispatcher | null } = {
  current: null,
};

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;
  if (dispatcher === null) {
    throw new Error(
      "Invalid hook call. Hooks can only be called inside of the body of a function component."
    );
  }

  return dispatcher;
};

export default currentDispatcher;
