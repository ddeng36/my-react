import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer as insertChildToContainer,
  removeChild,
} from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import {
  ChildDeletion,
  Flags,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Ref,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";
let nextEffect: FiberNode | null = null;

// 1.from top to bottom to find the first child that has mutation itself!!! this fiber's children don't have mutation while itself has mutation
// 2.from bottom to top to commit mutation
export const commitEffects = (
  phrase: "mutation" | "layout",
  mask: Flags,
  callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork;
    while (nextEffect !== null) {
      // top down
      const child: FiberNode | null = nextEffect.child;

      if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
        nextEffect = child;
      } else {
        // bottom up
        up: while (nextEffect !== null) {
          callback(nextEffect, root);
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
};
// During this phase, wo only insert child single DOM to parent DOM
const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const { flags, tag } = finishedWork;
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
        commitDeletion(childToDelete, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
  if ((flags & PassiveEffect) !== NoFlags) {
    // collect create callbacks
    commitPassiveEffect(finishedWork, root, "update");
    finishedWork.flags &= ~PassiveEffect;
  }
  // if there is flag
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    safelyDetachRef(finishedWork);
  }
};

function safelyDetachRef(current: FiberNode) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === "function") {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}
const commitLayoutEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const { flags, tag } = finishedWork;

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 绑定新的ref
    safelyAttachRef(finishedWork);
    finishedWork.flags &= ~Ref;
  }
};

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref;
  if (ref !== null) {
    const instance = fiber.stateNode;
    if (typeof ref === "function") {
      ref(instance);
    } else {
      ref.current = instance;
    }
  }
}

export const commitMutationEffects = commitEffects(
  "mutation",
  MutationMask | PassiveMask,
  commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
  "layout",
  LayoutMask,
  commitLayoutEffectsOnFiber
);

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // update unmount
  if (
    fiber.tag !== FunctionComponent ||
    (type === "update" && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error("when commitPassiveEffect, lastEffect should not be null");
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

// loop through the linked list of create
function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

// loop through the linked list of destroy last time
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
    effect.tag &= ~HookHasEffect;
  });
}

// loop through the linked list of destroy
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === "function") {
      effect.destroy = create();
    }
  });
}

function recordHostChildrenToDelete(
  ChildToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. find the fist host node
  const lastOne = ChildToDelete[ChildToDelete.length - 1];
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
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  let rootChildren: FiberNode | null = null;
  const rootChildrenToDelete: FiberNode[] = [];
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootChildren === null) {
          rootChildren = unmountFiber;
        }
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        safelyDetachRef(unmountFiber);
        return;
      case HostText:
        if (rootChildren === null) {
          rootChildren = unmountFiber;
        }
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // TODO unmount ref,useEffect
        // collect destroy callbacks
        commitPassiveEffect(unmountFiber, root, "unmount");
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
