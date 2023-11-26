import { REACT_ELEMENT_TYPE } from "shared/ReactSymbol";
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress,
} from "./fiber";
import { Props, ReactElementType } from "shared/ReactTypes";
import { HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

function ChildReconciler(shouldTrackSideEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackSideEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    work: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // sam key
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // if same key and same type, use old one
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          // if same key but different type, delete old one
          deleteChild(returnFiber, currentFiber);
          break work;
        } else {
          if (__DEV__) {
            console.warn("Unknow child type: ", element);
            break work;
          }
        }
      } else {
        // different key
        deleteChild(returnFiber, currentFiber);
      }
    }
    // Create new fiber AND RETURN
    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    if (currentFiber !== null) {
      //update
      if (currentFiber.tag === HostText) {
        // type didn't change, just use old type
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      deleteChild(returnFiber, currentFiber);
    }
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }
  function placeSingleChild(fiber: FiberNode) {
    // if first page rendering and should track side effects
    if (shouldTrackSideEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiberNode: FiberNode | null,
    newChild?: ReactElementType | null
  ) {
    // if node is FiberNode
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiberNode, newChild)
          );
        default:
          if (__DEV__) {
            console.warn("Unknow child type: ", newChild);
          }
          break;
      }
    }

    //TODO multiple children ul> lis*3

    // HostText
    if (typeof newChild === "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiberNode, newChild)
      );
    }

    if (currentFiberNode !== null) {
      // just in case missing deletions
      deleteChild(returnFiber, currentFiberNode);
    }

    if (__DEV__) {
      console.warn("Unknow child type: ", newChild);
    }
    return null;
  };
}

// clone
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

// track side effects
export const reconcileChildFibers = ChildReconciler(true);
// not track side effects
export const mountChildFibers = ChildReconciler(false);
