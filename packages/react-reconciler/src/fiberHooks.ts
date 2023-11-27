import { useState } from "react";
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdateQueue,
  processUpdateQueue,
} from "./updateQueue";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "../../react/src/currentDispatcher";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import internals from "shared/internals";

let currentRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;

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
  // reset hooks
  wip.memorizedState = null;

  const current = wip.alternate;
  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  // FC render
  const children = Component(props);

  // reset
  currentRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  return children;
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
};
function updateState<State>(): [State, Dispatch<State>] {
  // find current hook data for current useState
  const hook = updateWorkInProgressHook();

  // calculate next state
  const queue = hook.UpdateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;
  if (pending !== null) {
    const { memorizedState } = processUpdateQueue(hook.memorizedState, pending);
    hook.memorizedState = memorizedState;
  }
  return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;
  // TODO rendering phase update

  if (currentHook === null) {
    // the first FC update hook
    const current = currentRenderingFiber?.alternate;
    if (current !== null) {
      // update
      nextCurrentHook = current?.memorizedState;
    } else {
      // mount
      nextCurrentHook = null;
    }
  } else {
    // next hooks in this FC while updating
    nextCurrentHook = currentHook.next;
  }
  if (nextCurrentHook === null) {
    // mount u1,u2,u3
    // update u1,u2,u3,u4 -> one more hook means hook defined in if statement, which is illegal
    throw new Error("Rendered more hooks than during the previous render");
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memorizedState: currentHook.memorizedState,
    UpdateQueue: currentHook.UpdateQueue,
    next: null,
  };
  if (workInProgressHook === null) {
    // the first hook during mounting
    if (currentRenderingFiber === null) {
      throw new Error(
        "Hooks can only be called inside the body of a function component"
      );
    } else {
      workInProgressHook = newHook;
      currentRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // next hooks during mounting
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }

  return workInProgressHook;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
};

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // find the current hook data for current useState
  const hook = mountWorkInProgressHook();
  let memorizedState;
  if (initialState instanceof Function) {
    memorizedState = initialState();
  } else {
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
    next: null,
  };
  if (workInProgressHook === null) {
    // This is the first hook in the list
    if (currentRenderingFiber === null) {
      throw new Error(
        "Hooks can only be called inside the body of a function component"
      );
    } else {
      workInProgressHook = hook;
      currentRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // next hooks in mount
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
