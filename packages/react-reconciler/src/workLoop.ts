import {
  FiberNode,
  createWorkInProgress,
  FiberRootNode,
  PendingPassiveEffects,
} from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import {
  HostEffectMask,
  MutationMask,
  NoFlags,
  PassiveMask,
} from "./fiberFlags";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects,
} from "./commitWork";
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  getNextLane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
  mergeLanes,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { scheduleMicroTask } from "hostConfig";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_cancelCallback,
  unstable_shouldYield,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";
import { SuspenseException, getSuspenseThenable } from "./thenable";
import { resetHooksOnUnwind } from "./fiberHooks";
import { throwException } from "./fiberThrow";
import { unwindWork } from "./fiberUnwindWork";
// A pointer to the working in-progress fiber.
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

type RootExitStatus = number;
const RootInprogress = 0;
const RootInComplete = 1;
const RootCompleted = 2;
// 未完成状态，不用进入commit阶段
const RootDidNotComplete = 3;
let workInProgressRootExitStatus: number = RootInprogress;

// Suspense
type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 6;
let workInProgressSuspendedReason: SuspendedReason = NotSuspended;
let workInProgressThrownValue: any = null;

// initialize the stack
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}
// schedule phase entry point
export function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getNextLane(root);
  const existingCallback = root.callbackNode;
  // cancel the callback
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
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
  if (__DEV__) {
    console.log(
      `use ${updateLane === SyncLane ? "micro" : "macro"} task，priority：`,
      updateLane
    );
  }
  if (updateLane === SyncLane) {
    // Synchronized priority, use micro tasks
    if (__DEV__) {
      // add cb func to array => [performSyncWorkOnRoot,performSyncWorkOnRoot,performSyncWorkOnRoot]
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
      // only execute once, run all performSyncWorkOnRoot in the queue
      // This method is a micro task!!!!
      scheduleMicroTask(flushSyncCallbacks);
    }
  } else {
    // another type of priority, use macro tasks
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root)
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

  const lane = getNextLane(root);
  const curCallbackNode = root.callbackNode;
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout;
  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  switch (exitStatus) {
    case RootInComplete:
      // interrupt
      if (root.callbackNode !== curCallbackNode) {
        return null;
      }
      return performConcurrentWorkOnRoot.bind(null, root);

    case RootCompleted:
      // finished
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = lane;
      wipRootRenderLane = NoLane;
      commitRoot(root);
      break;
    case RootDidNotComplete:
      markRootSuspended(root, lane);
      wipRootRenderLane = NoLane;
      ensureRootIsScheduled(root);
      break;
    default:
      if (__DEV__) {
        console.error("还未实现的并发更新结束状态");
      }
  }
}

// original name: renderRoot
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getNextLane(root);
  if (nextLane !== SyncLane) {
    // lower priority lane, do nothing
    // NoLane
    // not sync update
    ensureRootIsScheduled(root);
    return;
  }
  const exitStatus = renderRoot(root, nextLane, false);

  switch (exitStatus) {
    case RootCompleted:
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = nextLane;
      wipRootRenderLane = NoLane;
      commitRoot(root);
      break;
    case RootDidNotComplete:
      wipRootRenderLane = NoLane;
      markRootSuspended(root, nextLane);
      ensureRootIsScheduled(root);
      break;
    default:
      if (__DEV__) {
        console.error("还未实现的同步更新结束状态");
      }
      break;
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(
      `start ${shouldTimeSlice ? "concurrent" : "synchronizing"} update`,
      root
    );
  }

  if (wipRootRenderLane !== lane) {
    // initialize
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (
        workInProgressSuspendedReason !== NotSuspended &&
        workInProgress !== null
      ) {
        const thrownValue = workInProgressThrownValue;

        workInProgressSuspendedReason = NotSuspended;
        workInProgressThrownValue = null;

        throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane);
      }
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("Error in workLoop", e);
      }
      handleThrow(root, e);
    }
  } while (true);
  if (workInProgressRootExitStatus !== RootInprogress) {
    return workInProgressRootExitStatus;
  }
  // interrupt
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  // render finished
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`wip shouldn't be null when sync update is completed`);
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
    commitLayoutEffects(finishedWork, root);
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
export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// if fiber is from createRoot().render(), then this fiber is root fiber
// if fiber is from setState(), then this fiber is the fiber that setState() is called on, we need to find the root fiber
export function markUpdateFromFiberToRoot(fiber: FiberNode) {
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

function handleThrow(root: FiberRootNode, thrownValue: any): void {
  /*
		throw
			1. use thenable
			2. error (Error Boundary处理)
	*/
  if (thrownValue === SuspenseException) {
    workInProgressSuspendedReason = SuspendedOnData;
    thrownValue = getSuspenseThenable();
  } else {
    // TODO Error Boundary
  }
  workInProgressThrownValue = thrownValue;
}

function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  thrownValue: any,
  lane: Lane
) {
  // reset hook before unwind
  resetHooksOnUnwind(unitOfWork);
  throwException(root, thrownValue, lane);
  unwindUnitOfWork(unitOfWork);
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  let incompleteWork: FiberNode | null = unitOfWork;
  do {
    const next = unwindWork(incompleteWork);

    if (next !== null) {
      next.flags &= HostEffectMask;
      workInProgress = next;
      return;
    }

    const returnFiber = incompleteWork.return as FiberNode;
    if (returnFiber !== null) {
      returnFiber.deletions = null;
    }
    incompleteWork = returnFiber;
    // workInProgress = incompleteWork;
  } while (incompleteWork !== null);

  workInProgress = null;
  workInProgressRootExitStatus = RootDidNotComplete;
}
