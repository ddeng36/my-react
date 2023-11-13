export type ElementType = any;
export type Key = any;
export type Ref = any;
export type Props = any;

export interface ReactElement {
    $$typeof: Symbol | number;
    type: ElementType;
    key : Key;
    ref : Ref;
    props : Props;
    __mark : string;
}

