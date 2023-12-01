import { FiberNode, createWorkInProgress, FiberRootNode } from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import { MutationMask, NoFlags } from "./fiberFlags";
import { commitMutationEffects } from "./commitWork";
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  markRootFinished,
  mergeLanes,
} from "./FiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { scheduleMicroTask } from "hostConfig";

// A pointer to the working in-progress fiber.
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
// initialize the stack
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

// original name: renderRoot
function performSyncWorkOnRoot(rootFiber: FiberRootNode, lane: Lane) {
  const nextLanes = getHighestPriorityLane(rootFiber.pendingLanes);
  if (nextLanes !== SyncLane) {
    // loewr priority lane, do nothing
    // NoLane
    // not sync update
    ensureRootIsScheduled(rootFiber);
    return;
  }
  if (__DEV__) {
    console.warn("Render Phase begin");
  }
  prepareFreshStack(rootFiber, lane);
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("Error in render: ", e);
      }
      workInProgress = null;
    }
  } while (true);

  const finishedWord = rootFiber.current.alternate;
  rootFiber.finishedWork = finishedWord;
  rootFiber.finishedLane = lane;
  wipRootRenderLane = NoLane;
  // exec commit phase
  commitRoot(rootFiber);
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

  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeHasEffect || rootHasEffect) {
    // before mutation

    // mutation Placement:
    commitMutationEffects(finishedWork);

    root.current = finishedWork;

    // layout
  } else {
    root.current = finishedWork;
  }
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

// schedule phase entry point
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    return;
  }
  if (updateLane === SyncLane) {
    // Synchronized priority, use micro tasks
    if (__DEV__) {
      console.log("schedule in micro task", root);
      // add cb func to array => [performSyncWorkOnRoot,performSyncWorkOnRoot,performSyncWorkOnRoot]
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
      // only execute once
      scheduleMicroTask(flushSyncCallbacks);
    }
  } else {
    // another type of priority, use macro tasks
  }
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
function workLoop() {
  while (workInProgress !== null) {
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
