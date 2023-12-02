export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

// For current Fiber, there is Effect in this round of update
export const PassiveEffect = 0b0001000;

// When commitWork will be triggered
export const MutationMask = Placement | Update | ChildDeletion;

// When useEffect will be triggered
// 1. passive effect：
// 2. child deletion: when <App/>is unmounted,the cb in return of useEffect should be executed.
export const PassiveMask = PassiveEffect | ChildDeletion;
