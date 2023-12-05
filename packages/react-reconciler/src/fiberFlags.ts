export type Flags = number;

export const NoFlags = 0b00000000000000000000000000;
export const Placement = 0b00000000000000000000000010;
export const Update = 0b00000000000000000000000100;
export const ChildDeletion = 0b00000000000000000000010000;

// For current Fiber, there is Effect in this round of update
export const PassiveEffect = 0b00000000000000000000100000;
export const Ref = 0b000000000000000000001000000;

// When commitWork will be triggered
export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Ref;

// When useEffect will be triggered
// 1. passive effect：
// 2. child deletion: when <App/>is unmounted,the cb in return of useEffect should be executed.
export const PassiveMask = PassiveEffect | ChildDeletion;
