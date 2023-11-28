import { REACT_ELEMENT_TYPE } from "shared/ReactSymbol";
import {
  FiberNode,
  createFiberFromElement,
  createWorkInProgress,
} from "./fiber";
import { Props, ReactElementType } from "shared/ReactTypes";
import { HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";
type ExistingChildren = Map<string | number, FiberNode>;

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
  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackSideEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
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
            // single element situation: only single element is left after update
            // a1,b2,c3 -> a1
            // only first old one is used, others would be delete
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          // if same key but different type, delete old one
          // a1,b2,c3 -> b1
          // delete all children
          deleteRemainingChildren(returnFiber, currentFiber);
          break work;
        } else {
          if (__DEV__) {
            console.warn("Unknow child type: ", element);
            break work;
          }
        }
      } else {
        // different key
        // delete old one
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
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
    while (currentFiber !== null) {
      //update
      if (currentFiber.tag === HostText) {
        // type didn't change, just use old type, same as reconcileSingleElement
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      deleteChild(returnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
    }
    // could not use old one, create new one
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
  function reconcileChildArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    // th last reusable fiber's index in current process
    let lastPlacedIndex: number = 0;
    // the last created fiber
    let lastNewFiber: FiberNode | null = null;
    // return the first created new Fiber
    let firstNewFiber: FiberNode | null = null;

    // 1. save current in map.
    const existingChildren: ExistingChildren = new Map();
    // we could see sibling direction as left to right, so FN turn to LinkedList
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }
    for (let i = 0; i < newChild.length; i++) {
      // 2. go through newChild to see if there are possibility to reuse old one.
      const after = newChild[i];

      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);

      if (newFiber === null) {
        continue;
      }
      // 3. move or insert flags?
      // lastPlacedIndex -> currentIdx
      // A1,B2,C3 -> B2,C3,A1
      // 0 ,1 ,2  -> 0 ,1 ,2
      // 1. currentNode: B2, currentIdx: 0, lastPlacedIndex: 0
      //    currentIdx >= lastPlacedIndex, so don't need to move
      // 2. currentNode: C3, currentIdx: 1, lastPlacedIndex: 1
      //    currentIdx >= lastPlacedIndex, so don't need to move
      // 3. currentNode: A1, currentIdx: 2, lastPlacedIndex: 0
      //    currentIdx < lastPlacedIndex, so need to move
      newFiber.index = i;
      newFiber.return = returnFiber;
      if (lastNewFiber === null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }
      if (!shouldTrackSideEffects) {
        continue;
      }
      const current = newFiber.alternate;
      if (current !== null) {
        // update
        // Placement in update means move
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          newFiber.flags |= Placement;
          continue;
        } else {
          lastPlacedIndex = oldIndex;
        }
      } else {
        // mount
        // Placement in mount means insert
        newFiber.flags |= Placement;
      }
    }

    // 4. delete remain old ones, which has no chance to be reused.
    existingChildren.forEach((child) => deleteChild(returnFiber, child));
    return firstNewFiber;
  }
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);
    if (typeof element === "string" || typeof element === "number") {
      // HostText
      if (before) {
        if (before.tag === HostText) {
          // could reuse
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + "" });
        }
      }
      // could not reuse
      return new FiberNode(HostText, { content: element + "" }, null);
    }

    if (typeof element === "object" && element !== null) {
      // ReactElement
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (before) {
            if (before.tag === element.type) {
              // could reuse
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          // could not reuse
          return createFiberFromElement(element);
        }
      }

      // TODO element could be a array or fragment in jsx
      // <ul> [<li>,<li>,<div>] </ul>
      if (Array.isArray(element) && __DEV__) {
        console.warn("Not available for array in jsx now", element);
        return null;
      }
    }
    return null;
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

    // multiple children ul> lis*3
    if (Array.isArray(newChild)) {
      return reconcileChildArray(returnFiber, currentFiberNode, newChild);
    }

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
