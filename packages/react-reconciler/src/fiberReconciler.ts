import { Container } from '../../react-dom/src/hostConfig';
import { HostRoot } from './workTags';
import { FiberNode, FiberRootNode } from './fiber';
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdateQueue } from './updateQueue';
import { ReactElementType } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';


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
export function updateContainer(element: ReactElementType | null, root: FiberRootNode) {
    const hostRootFiber = root.current;
    const update = createUpdate<ReactElementType | null>(element);
    enqueueUpdateQueue(hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>
        , update)
    scheduleUpdateOnFiber(hostRootFiber);
    return element
}