import { REACT_ELEMENT_TYPE } from "shared/ReactSymbol";
import { FiberNode, createFiberFromElemnt } from "./fiber";
import { ReactElementType } from "shared/ReactTypes";
import { HostText } from "./workTags";
import { Placement } from "./fiberFlags";

function ChildReconciler(shouldTrackSideEffects: boolean) {
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    // Create new fiber AND RETURN
    const fiber = createFiberFromElemnt(element);
    fiber.return = returnFiber;
    return fiber;
  }
  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
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

    //TODO multiple children
    // HostText
    if (typeof newChild === "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiberNode, newChild)
      );
    }
    if (__DEV__) {
      console.warn("Unknow child type: ", newChild);
    }
    return null;
  };
}

// track side effects
export const reconcileChildFibers = ChildReconciler(true);
// not track side effects
export const mountChildFibers = ChildReconciler(false);
