import { UpdateQueue, processUpdateQueue } from './updateQueue';
import { FiberNode } from "./fiber";
import { HostComponent, HostRoot, HostText,FunctionComponent } from "./workTags";
import { ReactElementType } from 'shared/ReactTypes';
import { reconcileChildFibers, mountChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
// DFS: from top to bottom
// Compare 
// return child FiberNode
export const beginWork = (wip: FiberNode) : FiberNode | null => {
    switch (wip.tag) {
        case HostRoot:
            return updateHostRoot(wip);
        case HostComponent:
            return updateHostComponent(wip);
        case HostText:
            // start complete phase
            return null;
        case FunctionComponent:
            return updateFunctionComponent(wip);
        default:
            if (__DEV__) {
                console.warn('beginWork() did implements tag: ', wip.tag);
            }
            break;
    }
    return null;
};

function updateHostRoot(wip: FiberNode) {
    const baseState = wip.memorizedState;
    const updateQueue = wip.updateQueue as UpdateQueue<Element>;
    const pending = updateQueue.shared.pending;
    updateQueue.shared.pending = null;
    const { memorizedState } = processUpdateQueue(baseState, pending);
    wip.memorizedState = memorizedState;
    const nextChild = wip.memorizedState;
    reconcileChildren(wip, nextChild);
    return wip.child;
}
function updateFunctionComponent(wip: FiberNode) {
    const nextChildren = renderWithHooks(wip);
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function updateHostComponent(wip: FiberNode) {
    // console.log(<div a=1 key={1}>1<div>2</div></div>)
    // {
    //     $$typeof: Symbol(react.element),
    //     type: "div",
    //     key: "1",
    //     ref: null,
    //     props: {
    //         a: 1,
    //     }
    // }
    // children are in props
    const nextProps = wip.pendingProps;
    const nextChildren = nextProps.children;
    reconcileChildren(wip, nextChildren);
    return wip.child;
}

function reconcileChildren(wip: FiberNode, children? : ReactElementType){
    const current = wip.alternate;
    if (current !== null) {
        // update
        wip.child =  reconcileChildFibers(wip, current?.child, children)
    }
    else {
        // mount
        wip.child = mountChildFibers(wip, null,children);
    }
}