import { Dispatch } from "../../react/src/currentDispatcher";
import { Action } from "../../shared/ReactTypes";
import { FiberNode } from "./fiber";
import { isSubsetOfLanes, Lane, mergeLanes, NoLane } from "./fiberLanes";

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
  hasEagerState: boolean;
  eagerState: State | null;
}


export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane,
  hasEagerState = false,
  eagerState = null
): Update<State> => {
  // For HostRootFiber, action is child ReactElement of FunctionComponent
  return {
    action,
    lane,
    next: null,
    hasEagerState,
    eagerState,
  };
};

export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  } as UpdateQueue<State>;
};

export const enqueueUpdateQueue = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>,
  fiber: FiberNode,
  lane: Lane
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    // pending: a -> a , circular linked list
    update.next = update;
  } else {
    // b.next -> a.next = a
    update.next = pending.next;
    // a.next -> b
    pending.next = update;
    // pending: b -> a -> b
  }
  // pending = update: b -> a -> b
  updateQueue.shared.pending = update;

  fiber.lanes = mergeLanes(fiber.lanes, lane);
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
};

export function basicStateReducer<State>(
  state: State,
  action: Action<State>
): State {
  // baseState 1 update (x) => 4x -> memorizedState 4
  // baseState 1 update 2 -> memorizedState 2
  return action instanceof Function ? action(state) : action;
}

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane,
  onSkipUpdate?: <State>(skippedUpdate: Update<State>) => void
): {
  memorizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState,
    baseState,
    baseQueue: null,
  };

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;

    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够 被跳过
        const clone = createUpdate(
          pending.action,
          pending.lane,
          pending.hasEagerState,
          pending.eagerState
        );

        onSkipUpdate?.(clone);

        // 是不是第一个被跳过的
        if (newBaseQueueFirst === null) {
          // first u0 last = u0
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          // first u0 -> u1 -> u2
          // last u2
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        const action = pending.action;
        if (pending.hasEagerState) {
          newState = pending.eagerState;
        } else {
          newState = basicStateReducer(baseState, action);
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update被跳过
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memorizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
