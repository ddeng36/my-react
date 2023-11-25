import { Container, appendChildToContainer } from "react-dom/src/hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";
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
  // flags ChildDeletion
};

const commitPlacement = (finishedWork: FiberNode) => {
  // parent DOM
  // finishedWord ~ DOM
  if (__DEV__) {
    console.warn("commitPlacement", finishedWork);
  }
  const hostParent = getHostParent(finishedWork);
  // finishedWork ~ DOM
  // finishedWork ~~ DOM append to parent DOM
  if (hostParent !== null) {
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
  }
};

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

function appendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
