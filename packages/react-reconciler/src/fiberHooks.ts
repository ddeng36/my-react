import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdateQueue } from './updateQueue';
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from '../../react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import internals from 'shared/internals';

let currentRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;
interface Hook {
    // different meaning for FiberNode and Hook
    memorizedState: any;
    UpdateQueue: unknown;
    next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
    // initialize
    currentRenderingFiber = wip;
    wip.memorizedState = null;

    const current = wip.alternate;
    if (current !== null) {
        // update
        // wip.memorizedState = current.memorizedState;
    }
    else {
        // mount
        currentDispatcher.current = HooksDispatcherOnMount;
    }

    const Component = wip.type;
    const props = wip.pendingProps
    const children = Component(props);

    // reset
    currentRenderingFiber = null;
    return children;
}

const HooksDispatcherOnMount: Dispatcher = {
    useState: mountState
}

function mountState<State>(
    initialState: (() => State) | State
): [State, Dispatch<State>] {
    // find the current hook data for current useState
    const hook = mountWorkInProgressHook();
    let memorizedState;
    if (initialState instanceof Function) {
        memorizedState = initialState();
    }
    else {
        memorizedState = initialState;
    }
    const queue = createUpdateQueue<State>();
    hook.UpdateQueue = queue;
    hook.memorizedState = memorizedState;
    // @ts-ignore
    const dispatch = dispatchSetState.bind(null, currentRenderingFiber, queue);
    queue.dispatch = dispatch;
    return [memorizedState, dispatch];
}
function dispatchSetState<State>(
    fiber: FiberNode,
    UpdateQueue: UpdateQueue<State>,
    action: Action<State>
) {
    const update = createUpdate(action);
    enqueueUpdateQueue(UpdateQueue, update);
    scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook(): Hook {
    const hook: Hook = {
        memorizedState: null,
        UpdateQueue: null,
        next: null
    }
    if (workInProgressHook === null) {
        // This is the first hook in the list
        if (currentRenderingFiber === null) {
            throw new Error('Hooks can only be called inside the body of a function component');
        }
        else {
            workInProgressHook = hook
            currentRenderingFiber.memorizedState = workInProgressHook;
        }
    }
    else {
        // next hooks in mount
        workInProgressHook.next = hook;
        workInProgressHook = hook;
    }
    return workInProgressHook;
}

