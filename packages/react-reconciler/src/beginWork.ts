import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import {
  FiberNode,
  OffscreenProps,
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress,
} from "./fiber";
import {
  HostComponent,
  HostRoot,
  HostText,
  FunctionComponent,
  Fragment,
  ContextProvider,
  SuspenseComponent,
  OffscreenComponent,
} from "./workTags";
import { ReactElementType } from "shared/ReactTypes";
import { reconcileChildFibers, mountChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref,
} from "./fiberFlags";
import { pushProvider } from "./fiberContext";
import { pushSuspenseHandler } from "./suspenseContext";

// beginWork is the first phase of reconciliation.it returns a wip.child
// 1. get next children(for different type of fiber, next children are different)
// 2. do some special things for different type of fiber(initialize queue for HostRootFiber, initialize Hook for FunctionComponent, etc.)
// 3. reconcile children
export const beginWork = (
  wip: FiberNode,
  renderLane: Lane
): FiberNode | null => {
  // each type update would finally call reconcileChildren
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      // start complete phase
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    default:
      if (__DEV__) {
        console.warn("beginWork() did implements tag: ", wip.tag);
      }
      break;
  }
  return null;
};
function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memorizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memorizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memorizedState = memorizedState;

  const current = wip.alternate;
  if (current !== null) {
    current.memorizedState = memorizedState;
  }

  const nextChild = wip.memorizedState;
  reconcileChildren(wip, nextChild);
  return wip.child;
}
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostComponent(wip: FiberNode) {
  // console.log(<div a=1 key={1}>1<div>2</div></div>)
  // {
  //     $$typeof: Symbol(react.element),
  //     type: "div",
  //     key: "1",
  //     ref: null,
  //     props: {
  //         a: 1,
  //     }
  // }
  // children are in props
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  markRef(wip.alternate, wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateContextProvider(wip: FiberNode) {
  const providerType = wip.type;
  const context = providerType._context;
  const newProps = wip.pendingProps;
  pushProvider(context, newProps.value);
  const nextChildren = newProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  // in first page, only host's alternate is not null
  // so others will be null, don't considerate side effect for them.
  if (current !== null) {
    // update
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    // mount
    wip.child = mountChildFibers(wip, null, children);
  }
}

function markRef(current: FiberNode | null, wip: FiberNode) {
  const ref = wip.ref;
  if (
    // when mount, and there is a ref
    (current === null && ref !== null) ||
    // when update, and ref is changed
    (current !== null && current.ref !== ref)
  ) {
    wip.flags |= Ref;
  }
}

function updateOffscreenComponent(workInProgress: FiberNode) {
  const nextProps = workInProgress.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(workInProgress, nextChildren);
  return workInProgress.child;
}

function updateSuspenseComponent(workInProgress: FiberNode) {
  const current = workInProgress.alternate;
  const nextProps = workInProgress.pendingProps;

  let showFallback = false;
  const didSuspend = (workInProgress.flags & DidCapture) !== NoFlags;

  if (didSuspend) {
    showFallback = true;
    workInProgress.flags &= ~DidCapture;
  }
  const nextPrimaryChildren = nextProps.children;
  const nextFallbackChildren = nextProps.fallback;
  pushSuspenseHandler(workInProgress);

  if (current === null) {
    if (showFallback) {
      return mountSuspenseFallbackChildren(
        workInProgress,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      return mountSuspensePrimaryChildren(workInProgress, nextPrimaryChildren);
    }
  } else {
    if (showFallback) {
      return updateSuspenseFallbackChildren(
        workInProgress,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      return updateSuspensePrimaryChildren(workInProgress, nextPrimaryChildren);
    }
  }
}

function mountSuspensePrimaryChildren(
  workInProgress: FiberNode,
  primaryChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: "visible",
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  workInProgress.child = primaryChildFragment;
  primaryChildFragment.return = workInProgress;
  return primaryChildFragment;
}

function mountSuspenseFallbackChildren(
  workInProgress: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
  // parent's Suspense has already mount，so need to Placement fallback.
  fallbackChildFragment.flags |= Placement;

  primaryChildFragment.return = workInProgress;
  fallbackChildFragment.return = workInProgress;
  primaryChildFragment.sibling = fallbackChildFragment;
  workInProgress.child = primaryChildFragment;

  return fallbackChildFragment;
}

function updateSuspensePrimaryChildren(
  workInProgress: FiberNode,
  primaryChildren: any
) {
  const current = workInProgress.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: "visible",
    children: primaryChildren,
  };

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );
  primaryChildFragment.return = workInProgress;
  primaryChildFragment.sibling = null;
  workInProgress.child = primaryChildFragment;

  if (currentFallbackChildFragment !== null) {
    const deletions = workInProgress.deletions;
    if (deletions === null) {
      workInProgress.deletions = [currentFallbackChildFragment];
      workInProgress.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }

  return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
  workInProgress: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = workInProgress.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };
  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );
  let fallbackChildFragment;

  if (currentFallbackChildFragment !== null) {
    // reusable
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
    fallbackChildFragment.flags |= Placement;
  }
  fallbackChildFragment.return = workInProgress;
  primaryChildFragment.return = workInProgress;
  primaryChildFragment.sibling = fallbackChildFragment;
  workInProgress.child = primaryChildFragment;

  return fallbackChildFragment;
}
