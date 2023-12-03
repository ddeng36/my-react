import { Container } from "../../react-dom/src/hostConfig";
import { HostRoot } from "./workTags";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdateQueue,
} from "./updateQueue";
import { ReactElementType } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { requestUpdateLane } from "./fiberLanes";
import {
  unstable_ImmediatePriority,
  unstable_runWithPriority,
} from "scheduler";

// const root = ReactDOM.reateRoot(document.getElementById('root'));
// this process would call createContainer
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

// root.render(<App/>)
// this process would call updateContainer
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  // The default run mode of react is synchronous.
  // First Page Rendering is synchronous!!!
  unstable_runWithPriority(unstable_ImmediatePriority, () => {
    const hostRootFiber = root.current;
    const lane = requestUpdateLane();
    const update = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdateQueue(
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      update
    );
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });
  return element;
}
