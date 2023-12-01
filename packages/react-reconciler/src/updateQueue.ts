import { Dispatch } from "../../react/src/currentDispatcher";
import { Action } from "../../shared/ReactTypes";
import { Lane } from "./FiberLanes";

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  // For HostRootFiber, action is child ReactElement of FunctionComponent
  return {
    action,
    lane,
    next: null,
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
  update: Update<State>
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
};

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memorizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState,
  };

  if (pendingUpdate !== null) {
    // hte first update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pending.action;
        if (action instanceof Function) {
          // if pendingState is function, then call the function
          baseState = action(baseState);
        } else {
          // if pendingState is primitive type, then assign it directly
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error("error logic");
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);
  }
  result.memorizedState = baseState;
  return result;
};
