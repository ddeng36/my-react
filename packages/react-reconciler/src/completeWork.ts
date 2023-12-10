import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
  Instance,
} from "hostConfig";
import { FiberNode } from "./fiber";
import { NoFlags, Ref, Update, Visibility } from "./fiberFlags";
import {
  HostRoot,
  HostText,
  HostComponent,
  FunctionComponent,
  Fragment,
  ContextProvider,
  SuspenseComponent,
  OffscreenComponent,
  MemoComponent,
} from "./workTags";
import { popProvider } from "./fiberContext";
import { popSuspenseHandler } from "./suspenseContext";
import { mergeLanes, NoLanes } from "./fiberLanes";
function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}
function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}

// 1.to see whether there are possibility to reuse the old fiber
// 2.To create a new DOM if the old fiber can't be reused
// 3.To append new DOM to father DOM
// 4.To bubble properties to the new WIP
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
        // 1. whether props changed {onCLick: xx} {onClick:yy}
        // 2. whether Update flag changed
        // 3. whether classnames changed
        markUpdate(wip);
        // flag Ref : ref changed while updating
        if (current.ref !== wip.ref) {
          markRef(wip);
        }
      } else {
        // 1. construct DOM
        const instance = createInstance(wip.type, newProps);
        // 2. append DOM into DOM tree
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
        // flag Ref : ref while mounting
        if (wip.ref !== null) {
          markRef(wip);
        }
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        const oldText = current.memorizedProps?.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          // element changed will be flagged during beginWork
          // text changed will be flagged during completeWork
          markUpdate(wip);
        }
      } else {
        // 1. construct DOM
        const instance = createTextInstance(newProps.content);
        // 2. append DOM into DOM tree
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
    case Fragment:
    case FunctionComponent:
    case OffscreenComponent:
    case MemoComponent:
      bubbleProperties(wip);
      return null;
    case ContextProvider:
      const context = wip.type._context;
      popProvider(context);
      bubbleProperties(wip);
      return null;
    case SuspenseComponent:
      popSuspenseHandler();

      const offscreenFiber = wip.child as FiberNode;
      const isHidden = offscreenFiber.pendingProps.mode === "hidden";
      const currentOffscreenFiber = offscreenFiber.alternate;
      if (currentOffscreenFiber !== null) {
        const wasHidden = currentOffscreenFiber.pendingProps.mode === "hidden";

        if (isHidden !== wasHidden) {
          // visibility changed
          offscreenFiber.flags |= Visibility;
          bubbleProperties(offscreenFiber);
        }
      } else if (isHidden) {
        // hidden while mount
        offscreenFiber.flags |= Visibility;
        bubbleProperties(offscreenFiber);
      }
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn("completeWork did not implement the type: " + wip.tag);
      }
      break;
  }
  return null;
  function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
    // insert wip into parent
    let node = wip.child;
    while (node !== null) {
      // wip could be a not DOM fiber node(like FC,tag:0), so find the HostComponent or HostText
      if (node.tag === HostComponent || node.tag === HostText) {
        // append node to parent
        appendInitialChild(parent, node?.stateNode);
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === wip) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === wip) {
          return;
        }
        node = node?.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
};

function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;
  let child = wip.child;
  let newChildLanes = NoLanes;
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );
    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
  wip.childLanes = newChildLanes;
}
