import { WorkTag } from "./workTags";
import { Props, Key } from "../../shared/ReactTypes";
import { Flags, NoFlags, Placement, Update, Deletion } from "./fiberFlags";
import { Container } from "./hostConfig";

export class FiberNode {
  tag: WorkTag;
  key: Key;
  stateNode: any;
  type: any;
  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;
  ref: any;
  pendingProps: Props;
  memorizedProps: Props | null;
  memorizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  updateQueue: unknown;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // instance properties
    // FunctionComponent -> 0
    this.tag = tag;
    this.key = key;
    // HostNode -> <div> -> div's DOM
    this.stateNode = null;
    // FC -> FC()=>{}
    this.type = null;

    // Tree
    // point to FN's parent
    this.return = null;
    // point to FN's sibling
    this.sibling = null;
    // point to FN's child
    this.child = null;
    // <ul>li *3</ul> -> 0,1,2
    this.index = 0;

    this.ref = null;

    // working units
    // props before working
    this.pendingProps = pendingProps;
    // props after working
    this.memorizedProps = null;
    this.updateQueue = null;
    this.memorizedState = null;

    // point to current if it's working, and vice versa
    this.alternate = null;
    // side effect
    this.flags = NoFlags;
  }
}

export class FiberRootNode {
  // in browser, it is root dom element
  container: Container;
  // host root fiber
  current: FiberNode;
  // host root fiber after working
  finishedWork: FiberNode | null;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
  }
}
export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
) : FiberNode=> {
    // double cache 
    let wip = current.alternate;
    if(wip === null){
        // if it is first time, create a new fiber
        // mount
        wip = new FiberNode(current.tag, pendingProps, current.key);
        wip.stateNode = current.stateNode;
        wip.alternate = current;
        current.alternate = wip;
    }
    else{
        // update
        wip.pendingProps = pendingProps;
        // clear side effect flags
        wip.flags = NoFlags;
    }
    wip.type = current.type;
    wip.updateQueue = current.updateQueue;
    wip.child = current.child;
    wip.memorizedProps = current.memorizedProps;
    wip.memorizedState = current.memorizedState;

    return wip;
};
