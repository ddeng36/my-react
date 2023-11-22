import { Container, appendChildContainer } from "react-dom/hostConfig";
import { FiberNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";
let nextEffect: FiberNode | null = null;
export const commitMutationEffects = (finishedWord: FiberNode) =>{
    nextEffect = finishedWord;

    while(nextEffect !== null){
        //  from top to bottom
        const child: FiberNode | null = nextEffect.child;
        if((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child !== null){
            // first child that has mutation
            nextEffect = child;
        }
        else{
            // from bottom to top
            // if no subtreeFlags
            up: while (nextEffect !== null) {
                commitMutationEffectsOnFiber(nextEffect);
                const sibling : FiberNode | null = nextEffect.sibling;
                if(sibling !== null){
                    nextEffect = sibling;
                    break up;
                }
                nextEffect = nextEffect.return;
        }

            
    }
}
}
const commitMutationEffectsOnFiber = (finishedWork : FiberNode) => {
 const flags = finishedWork.flags;
 if((flags & Placement) !== NoFlags){
    commitPlacement(finishedWork);

    finishedWork.flags &= ~Placement;
 }
}

const commitPlacement = (finishedWork : FiberNode) => {
    // parent DOM 
    // finishedWord ~ DOM
    if(__DEV__){
        console.warn('commitPlacement',finishedWork)
    }
    const hostParent = getHostParent(finishedWork);
    // finishedWork ~ DOM
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
}

// get container
function getHostParent(fiber : FiberNode){
    let parent = fiber.return;
    while(parent) {
        const parentTag = parent.tag;
        
        // HostComponent HostRoot
        if (parentTag ===HostComponent) {
            return parent.stateNode as Container;
        }
        if (parentTag === HostRoot) {
            return parent.stateNode.container;
        }
        parent = parent.return;

    }
    if (__DEV__) {
        console.warn('host parent not found');
    }
}

function appendPlacementNodeIntoContainer(
    finishedWok : FiberNode, hostParent : Container
    ){
        // fiber host
        if(finishedWok.tag === HostComponent || finishedWok.tag === HostText){
            appendChildContainer(finishedWok.stateNode ,hostParent);
            return;
        }
        const child = finishedWok.child;
        if (child !== null) {
            appendPlacementNodeIntoContainer(child, hostParent);
            let  sibling = child.sibling;
            while (sibling !== null) {
                appendPlacementNodeIntoContainer(sibling, hostParent);
                sibling = sibling.sibling;
            }
        }
}