import {
  Update,
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
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTags";
import currentBatchConfig from "react/src/currentBatchConfig";

let currentRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;
interface Hook {
  // different meaning for FiberNode and Hook
  memorizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // initialize
  currentRenderingFiber = wip;
  // reset hooks
  wip.memorizedState = null;
  wip.updateQueue = null;
  renderLane = lane;

  // connect to different implementation for useState
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
  renderLane = NoLane;
  return children;
}

// Update
const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
};
function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = updateWorkInProgressHook();

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;

  const pending = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pending !== null) {
    // pending baseQueue update保存在current中
    if (baseQueue !== null) {
      // baseQueue b2 -> b0 -> b1 -> b2
      // pendingQueue p2 -> p0 -> p1 -> p2
      // b0
      const baseFirst = baseQueue.next;
      // p0
      const pendingFirst = pending.next;
      // b2 -> p0
      baseQueue.next = pendingFirst;
      // p2 -> b0
      pending.next = baseFirst;
      // p2 -> b0 -> b1 -> b2 -> p0 -> p1 -> p2
    }
    baseQueue = pending;
    // 保存在current中
    current.baseQueue = pending;
    queue.shared.pending = null;
  }
  if (baseQueue !== null) {
    const {
      memorizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState,
    } = processUpdateQueue(baseState, baseQueue, renderLane);
    hook.memorizedState = memorizedState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueue;
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
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState,
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
function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;
  if (currentHook !== null) {
    const prevEffect = currentHook.memorizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // shallow compare deps
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // shallow compare, not equal
    (currentRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memorizedState = pushEffect(
      // has effects
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState();
  const hook = updateWorkInProgressHook();
  const start = hook.memorizedState;
  return [isPending as boolean, start];
}

// Mount
const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition,
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
  hook.updateQueue = queue;
  hook.memorizedState = memorizedState;
  hook.baseState = memorizedState;
  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memorizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);
  enqueueUpdateQueue(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memorizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null,
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

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // get the first Hook
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  // when to execute the create cb?
  // 1. mount
  // 2. deps change
  // so we flag this hook as PassiveEffect
  (currentRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memorizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}
// Effect has its' own linked list
function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  };
  const fiber = currentRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    // first time
    const updateQueue = createFCUpdateQueue();
    // circular linked list
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    // insert to the end of the linked list
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setPending);

  hook.memorizedState = start;
  return [isPending, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  // 1. set isPending to true and update
  setPending(true);
  // 2. decrease priority
  const prevTransition = currentBatchConfig.transition;
  currentBatchConfig.transition = 1;
  // 3. execute callback
  callback();
  setPending(false);
  // 4. increase priority
  currentBatchConfig.transition = prevTransition;
}
