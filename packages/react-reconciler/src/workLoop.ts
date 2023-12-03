import {
  FiberNode,
  createWorkInProgress,
  FiberRootNode,
  PendingPassiveEffects,
} from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects,
} from "./commitWork";
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
} from "./FiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { scheduleMicroTask } from "hostConfig";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_cancelCallback,
  unstable_shouldYield,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";
// A pointer to the working in-progress fiber.
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

type RootExitStatus = number;
const RootInComplete = 1;
const RootCompleted = 2;

// initialize the stack
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}
// schedule phase entry point
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const existingCallback = root.callbackNode;

  if (updateLane === NoLane) {
    // cancel the callback
    if (updateLane === NoLane) {
      if (existingCallback !== null) {
        unstable_cancelCallback(existingCallback);
      }
      root.callbackNode = null;
      root.callbackPriority = NoLane;
      return;
    }
  }
  // update pointer
  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;
  // if same priority, do nothing
  if (curPriority === prevPriority) {
    return;
  }
  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback);
  }
  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // Synchronized priority, use micro tasks
    if (__DEV__) {
      console.log("schedule in micro task", root);
      // add cb func to array => [performSyncWorkOnRoot,performSyncWorkOnRoot,performSyncWorkOnRoot]
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
      // only execute once, run all performSyncWorkOnRoot in the queue
      // This method is a micro task!!!!
      scheduleMicroTask(flushSyncCallbacks);
    }
  } else {
    // another type of priority, use macro tasks
    const schedulerPrority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPrority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root, updateLane)
    );
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}
function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  // ensure that cb of useEffect are executed
  const curCallback = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout;
  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  ensureRootIsScheduled(root);

  if (exitStatus === RootInComplete) {
    // interupt
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  if (exitStatus === RootCompleted) {
    // finished
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;
    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的并发更新结束状态");
  }
}

// original name: renderRoot
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // loewr priority lane, do nothing
    // NoLane
    // not sync update
    ensureRootIsScheduled(root);
    return;
  }
  const exitStatus = renderRoot(root, nextLane, false);

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树 树中的flags
    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的同步更新结束状态");
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? "并发" : "同步"}更新`, root);
  }

  if (wipRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane);
  }

  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop发生错误", e);
      }
      workInProgress = null;
    }
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  // render阶段执行完
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`render阶段结束时wip不应该不是null`);
  }
  // TODO 报错
  return RootCompleted;
}

// If has side effect, Three sub phase:
// 1.before mutation
// 2. mutation
// 3.layout
function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }
  if (__DEV__) {
    console.warn("commitRoot begin", finishedWork);
  }

  const lane = root.finishedLane;
  if (lane === NoLane && __DEV__) {
    console.warn("commitRoot lane should not be NoLane");
  }

  // reset
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  // to schedule the passive effect
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // schedule a callback in normal priority
      scheduleCallback(NormalPriority, () => {
        // execute Effects
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // before mutation

    // mutation Placement:
    commitMutationEffects(finishedWork, root);

    root.current = finishedWork;

    // layout
  } else {
    root.current = finishedWork;
  }
  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

// Execute effects
// 1. loop through effects
// 2. trigger all the unmount effect.(func's create would not be called is it's destroy was called)
// 3. trigger the destroy in last update
// 4. trigger all the create in this update
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false;
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}
// would be called when:
// 1.createRoot().render() -> updateContainer()
// 2.setState() -> dispatchSetState()
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // TODO schedule
  // 1. find the HostRootFiber, and start work loop from it.
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  // original name: renderRoot
  ensureRootIsScheduled(root);
}
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// if fiber is from createRoot().render(), then this fiber is root fiber
// if fiber is from setState(), then this fiber is the fiber that setState() is called on, we need to find the root fiber
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    // move upward until find the HostRootFiber
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}
function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

// An unit of work contains 2 phases:
// 1. beginWork: from top to bottom, dive down if there is a child, otherwise, go to completeWork.
// 2. completeWork: from left to right, if there is a sibling, visit the sibling, otherwise, visit the parent.
function performUnitOfWork(fiber: FiberNode) {
  // beginWork return the child fiber
  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memorizedProps = fiber.pendingProps;
  if (__DEV__) {
    console.warn("performUnitOfWork", fiber);
  }
  if (next === null) {
    // if no child, complete the current fiber
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

// from bottom to top, if fiber has sibling, visit the siblings, if not, visit the parent.
function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    if (__DEV__) {
      console.warn("completeUnitOfWork", workInProgress);
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
