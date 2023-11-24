import { FiberNode, createWorkInProgress, FiberRootNode } from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import { MutationMask, NoFlags } from "./fiberFlags";
import { commitMutationEffects } from "./commitWork";

// A pointer to the working in-progress fiber.
let workInProgress : FiberNode | null = null;

// initialize the stack 
function prepareFreshStack(root : FiberRootNode) {
    workInProgress = createWorkInProgress(root.current,{});
}

function renderRoot(rootFiber : FiberRootNode) {
    prepareFreshStack(rootFiber);
    do{
        try{
            workLoop();
            break;
        }
        catch(e){
            if (__DEV__){
                console.warn('Error in render: ', e);
            }
            workInProgress = null;
        }
    }while(true);

    const finishedWord = rootFiber.current.alternate;
    rootFiber.finishedWork = finishedWord;
    // exec commit phase
    commitRoot(rootFiber); 
}
function commitRoot(root : FiberRootNode) {
    // 3 sub phase: before mutation, mutation, layout
    const finishedWork = root.finishedWork;

    if(finishedWork === null){
        return;
    }
    if(__DEV__){
        console.warn('commitRoot begin',finishedWork);
    }
    // reset 
    root.finishedWork = null;
    
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

    if (subtreeHasEffect || rootHasEffect) {

        // before mutation

        // mutation Placement:
        commitMutationEffects(finishedWork);

        root.current = finishedWork;
        

        // layout
    }
    else{
        root.current = finishedWork;
    }


}
export function scheduleUpdateOnFiber(fiber : FiberNode) {
    // TODO schedule 
    // if fiber is from createRoot().render(), then this fiber is root fiber
    // if fiber is from setState(), then this fiber is the fiber that setState() is called on, we need to find the root fiber
   const root = markUpdateFromFiberToRoot(fiber);
    renderRoot(root);
}

function markUpdateFromFiberToRoot(fiber : FiberNode){
    let node = fiber;
    let parent = node.return;
    while(parent !== null){
        node = parent;
        parent = node.return;
    }
    if (node.tag === HostRoot) {
        return node.stateNode;
    }
    return null;
}
function workLoop() {
    while(workInProgress !== null){
        performUnitOfWork(workInProgress);
    }
}

// from top to bottom, if fiber has child, just dive into it
function performUnitOfWork(fiber : FiberNode) {
    const next = beginWork(fiber);
    fiber.memorizedProps = fiber.pendingProps;
    if(__DEV__){
        console.warn('performUnitOfWork',fiber);
    }
    if (next === null) {
        // if no child, complete the current fiber
        completeUnitOfWork(fiber);
    }
    else{
        workInProgress = next;
    }
}

// from bottom to top, if fiber has sibling, visit the siblings, if not, visit the parent. 
function completeUnitOfWork(fiber : FiberNode) {
    let node : FiberNode | null = fiber;
    do{
        completeWork(node);
        const sibling = node.sibling;
        if(sibling !== null){
            workInProgress = sibling;
            return;
        }        
        if (__DEV__) {
            console.warn('completeUnitOfWork', workInProgress);
        }
        node = node.return;
        workInProgress = node;

    }
    while (node !== null);

}