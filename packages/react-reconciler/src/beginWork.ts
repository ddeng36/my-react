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
  MemoComponent,
} from "./workTags";
import { ReactElementType } from "shared/ReactTypes";
import {
  reconcileChildFibers,
  mountChildFibers,
  cloneChildFibers,
} from "./childFibers";
import { bailoutHooks, renderWithHooks } from "./fiberHooks";
import { Lane, NoLanes, includeSomeLanes } from "./fiberLanes";
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref,
} from "./fiberFlags";
import {
  prepareToReadContext,
  propagateContextChange,
  pushProvider,
} from "./fiberContext";
import { pushSuspenseHandler } from "./suspenseContext";
import { shallowEqual } from "shared/shallowEqual";

// need to update ?
let didReceiveUpdate = false;

export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}

// beginWork is the first phase of reconciliation.it returns a wip.child
// 1. get next children(for different type of fiber, next children are different)
// 2. do some special things for different type of fiber(initialize queue for HostRootFiber, initialize Hook for FunctionComponent, etc.)
// 3. reconcile children
export const beginWork = (
  wip: FiberNode,
  renderLane: Lane
): FiberNode | null => {
  // console.log('beginWork');
  const current = wip.alternate;
  didReceiveUpdate = false;

  if (current !== null) {
    const oldProps = current.memorizedProps;
    const newProps = wip.pendingProps;

    // 1. props是否变化
    if (oldProps !== newProps || current.type !== wip.type) {
      didReceiveUpdate = true;
    } else {
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLane
      );
      if (!hasScheduledUpdateOrContext) {
        didReceiveUpdate = false;
        switch (wip.tag) {
          case ContextProvider:
            const newValue = wip.memorizedProps.value;
            const context = wip.type._context;
            pushProvider(context, newValue);
            break;
        }
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }

  wip.lanes = NoLanes;
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
      return updateFunctionComponent(wip, wip.type, renderLane);
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip, renderLane);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    case MemoComponent:
      return updateMemoComponent(wip, renderLane);
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

  const prevChildren = wip.memorizedState;

  const { memorizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memorizedState = memorizedState;

  const current = wip.alternate;
  // 考虑RootDidNotComplete的情况，需要复用memorizedState
  if (current !== null) {
    if (!current.memorizedState) {
      current.memorizedState = memorizedState;
    }
  }
  const nextChildren = wip.memorizedState;
  if (prevChildren === nextChildren) {
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(
  wip: FiberNode,
  Component: FiberNode["type"],
  renderLane: Lane
) {
  // FC中可能有useContext，看看有没有context要执行
  prepareToReadContext(wip, renderLane);
  const nextChildren = renderWithHooks(wip, Component, renderLane);

  const current = wip.alternate;
  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(wip, renderLane);
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }

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

function updateMemoComponent(wip: FiberNode, renderLane: Lane) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;
  const Component = wip.type.type;

  if (current !== null) {
    const prevProps = current.memorizedProps;

    // 满足四要素中的 props对比
    if (shallowEqual(prevProps, nextProps) && current.ref === wip.ref) {
      didReceiveUpdate = false;

      wip.pendingProps = prevProps;

      if (!checkScheduledUpdateOrContext(current, renderLane)) {
        // 满足 state context
        wip.lanes = current.lanes;
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }
  return updateFunctionComponent(wip, Component, renderLane);
}

function updateContextProvider(wip: FiberNode, renderLane: Lane) {
  const providerType = wip.type;
  const context = providerType._context;

  const newProps = wip.pendingProps;
  const oldProps = wip.memorizedProps;
  const newValue = newProps.value;

  pushProvider(context, newValue);

  if (oldProps !== null) {
    const oldValue = oldProps.value;
    // context value没变，且children没变，复用
    if (
      Object.is(newValue, oldValue) &&
      oldProps.children === newProps.children
    ) {
      return bailoutOnAlreadyFinishedWork(wip, renderLane);
    } else {
      // context value变了
      propagateContextChange(wip, context, renderLane);
    }
  }

  const nextChildren = newProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
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

// 判断是否存在更新 或 context变化
function checkScheduledUpdateOrContext(
  current: FiberNode,
  renderLane: Lane
): boolean {
  const updateLanes = current.lanes;

  // 判断是否存在更新
  if (includeSomeLanes(updateLanes, renderLane)) {
    return true;
  }

  return false;
}

function bailoutOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
  // 跳过整个子树
  if (!includeSomeLanes(wip.childLanes, renderLane)) {
    if (__DEV__) {
      console.warn("bailout整棵子树", wip);
    }
    return null;
  }
  // 跳过当前fiber
  cloneChildFibers(wip);
  if (__DEV__) {
    console.warn("bailout一个fiber", wip);
  }
  return wip.child;
}
function reconcileChildren(wip: FiberNode, nextChildren: any) {
  throw new Error("Function not implemented.");
}
