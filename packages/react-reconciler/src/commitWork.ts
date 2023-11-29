import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertCHildToContainer as insertChildToContainer,
  removeChild,
} from "react-dom/src/hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
let nextEffect: FiberNode | null = null;
export const commitMutationEffects = (finishedWord: FiberNode) => {
  nextEffect = finishedWord;

  while (nextEffect !== null) {
    //  from top to bottom
    const child: FiberNode | null = nextEffect.child;
    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      // first child that has mutation
      nextEffect = child;
    } else {
      // from bottom to top
      // this fiber's children don't have mutation while itself has mutation
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);
        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};
const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
  const flags = finishedWork.flags;
  // if there is no flags
  // noflagse
  // 0 & 1 === 0
  // 0 !== 0
  // no commit
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }

  // flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
};
function recordHostChildrenToDelete(
  ChildToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. find the fist host node
  let lastOne = ChildToDelete[ChildToDelete.length - 1];
  if (!lastOne) {
    ChildToDelete.push(unmountFiber);
  } else {
    //not the first one, is it sibling of the first one?
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        ChildToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}
function commitDeletion(childToDelete: FiberNode) {
  let rootChildren: FiberNode | null = null;
  const rootChildrenToDelete: FiberNode[] = [];
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootChildren === null) {
          rootChildren = unmountFiber;
        }
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // TODO unmount ref
        return;
      case HostText:
        if (rootChildren === null) {
          rootChildren = unmountFiber;
        }
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // TODO unmount ref,useEffect
        return;
      default:
        if (__DEV__) {
          console.warn("unmount type didn't implement", unmountFiber);
        }
    }
  });

  // delete the DOM of rootHostComponent
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);
    // if node has child
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    // if node has sibling
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn("commitPlacement", finishedWork);
  }
  // parent DOM
  const hostParent = getHostParent(finishedWork);

  // host sibling
  // situation 1: move downward
  // it should be <A/><div/>
  // <A/><B/>
  // function B() {
  //   return <div/>;
  // }
  // situation 2 : move upward
  // it should be <A/><div/>
  // <App/><div/>
  // function App() {
  //   return <A/>;
  // }
  const sibling = getHostSibling(finishedWork);

  // finishedWork ~ DOM
  // finishedWork ~~ DOM append to parent DOM
  if (hostParent !== null) {
    insertPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
};
function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;
  findSibling: while (true) {
    // first move downward, if con't match, then move upward
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostComponent && node.tag !== HostText) {
      // move downward
      // this one should be a table one (not moving and not HRF type)
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}
// get container
function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;

    // HostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn("host parent not found");
  }
  return null;
}

function insertPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    insertPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
