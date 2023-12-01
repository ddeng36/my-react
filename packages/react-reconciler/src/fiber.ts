import {
  FunctionComponent,
  HostComponent,
  WorkTag,
  Fragment,
} from "./workTags";
import { Props, Key, ReactElementType } from "../../shared/ReactTypes";
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "../../react-dom/src/hostConfig";
import { Lane, Lanes, NoLane, NoLanes } from "./FiberLanes";

export class FiberNode {
  // instance properties
  // FunctionComponent -> 0
  tag: WorkTag;
  key: Key | null;
  // HostNode use this property to point to FiberRootNode
  stateNode: any;
  // FC -> FC()
  // CC -> CC()
  // HostComponent Div -> div
  type: any;

  // Tree
  // point to FN's parent
  return: FiberNode | null;
  // point to FN's [[[FIRST RIGHT]]]sibling
  sibling: FiberNode | null;
  // point to FN's [[[FIRST]]] child
  child: FiberNode | null;
  // <ul>li *3</ul> -> 0,1,2
  index: number;

  ref: any;

  // working units
  // props before working
  pendingProps: Props;
  // props after working
  memorizedProps: Props | null;
  // pointing to the first hooks in the fiber, and the hooks are linked list, so we should use hooks in order
  memorizedState: any;
  // point to current if it's working（wip）, and vice versa
  alternate: FiberNode | null;
  // side effect
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.key = key;
    this.stateNode = null;
    this.type = null;

    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = pendingProps;
    this.memorizedProps = null;
    this.updateQueue = null;
    this.memorizedState = null;

    this.alternate = null;
    this.subtreeFlags = NoFlags;
    this.flags = NoFlags;
    this.deletions = null;
  }
}

export class FiberRootNode {
  // in browser, it is root dom element
  container: Container;
  // point to host root fiber before working
  current: FiberNode;
  // point to host root fiber after working
  finishedWork: FiberNode | null;
  pendingLanes: Lanes;
  finishedLane: Lane;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;
  }
}
export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  // double cache
  let wip = current.alternate;
  if (wip === null) {
    // if it is first time, create a new fiber
    // mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    // clear side effect flags
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memorizedProps = current.memorizedProps;
  wip.memorizedState = current.memorizedState;

  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === "string") {
    // <div> type : string
    fiberTag = HostComponent;
  } else if (typeof type !== "function" && __DEV__) {
    console.warn("Unknow child type: ", type);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}
export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}
