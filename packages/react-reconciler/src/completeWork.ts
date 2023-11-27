import {
  Container,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from "react-dom/src/hostConfig";
import { FiberNode } from "./fiber";
import {
  HostComponent,
  HostText,
  HostRoot,
  FunctionComponent,
} from "./workTags";
import { NoFlags, Update } from "./fiberFlags";
import { updateFiberProps } from "react-dom/src/SyntheticEvents";

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

// DFS: from bottom to top,
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
        // 1. whether props changed {onCLick: xx} {onClick:yy}
        // 2. whether Update flag changed
        // 3. whether classname changed
        updateFiberProps(wip.stateNode, newProps);
      } else {
        // 1. construct DOM
        const instance = createInstance(wip.type, newProps);
        // 2. append DOM into DOM tree
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        const oldText = current.memorizedProps?.content;
        const newText = newProps.content;
        if (oldText !== newText) {
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
      bubbleProperties(wip);
      return null;
    case FunctionComponent:
      bubbleProperties(wip);
      return null;

    default:
      if (__DEV__) {
        console.warn("completeWork did not implement the type: " + wip.tag);
      }
      break;
  }
  return null;
  function appendAllChildren(parent: Container, wip: FiberNode) {
    // insert wip into parent
    let node = wip.child;
    while (node !== null) {
      // wip could be a not DOM fibernode(like FC,tag:0), so find the HostComponent or HostText
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
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
