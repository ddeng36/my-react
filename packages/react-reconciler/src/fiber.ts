import { WorkTag } from "./workTags";
import { Props, Key } from "../../shared/ReactTypes";

export class FiberNode {
    tag: WorkTag;
    key: Key;
    stateNode: any;
    type: any;
    return: FiberNode | null;
    sibling: FiberNode | null;
    child: FiberNode | null;
    index: number;
    ref: any;
    pendingProps: Props;
    memoriedProps: Props | null;

    constructor(tag: WorkTag, pendingProps: Props, key: Key) {
        // instance properties
        // FunctionComponent -> 0
        this.tag = tag;
        this.key = key;
        // HostNode -> <div> -> div's DOM
        this.stateNode = null;
        // FC -> FC()=>{}
        this.type = null;

        // Tree 
        // point to FN's parent
        this.return = null;
        // point to FN's sibling
        this.sibling = null;
        // point to FN's child
        this.child = null;
        // <ul>li *3</ul> -> 0,1,2
        this.index = 0;

        this.ref = null;

        // working units
        // props before working
        this.pendingProps = pendingProps;
        // props after working
        this.memoriedProps = null;
    }
}
