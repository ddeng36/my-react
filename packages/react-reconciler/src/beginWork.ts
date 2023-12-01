import { UpdateQueue, processUpdateQueue } from "./updateQueue";
import { FiberNode } from "./fiber";
import {
  HostComponent,
  HostRoot,
  HostText,
  FunctionComponent,
  Fragment,
} from "./workTags";
import { ReactElementType } from "shared/ReactTypes";
import { reconcileChildFibers, mountChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./FiberLanes";

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
