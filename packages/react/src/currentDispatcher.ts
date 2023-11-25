import { Action } from "shared/ReactTypes";

export interface Dispatcher {
    useState: <T>(initialState: (() => T | T)) => [T, Dispatch<T>];
}
export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
    current: null
};

export const resolveDispatcher = (): Dispatcher => {
    const dispatcher = currentDispatcher.current;
    if (dispatcher === null) {
        throw new Error("Invalid hook call. Hooks can only be called inside of the body of a function component.");
    }


    return dispatcher;
}

export default currentDispatcher;