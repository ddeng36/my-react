export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

export const PassiveEffect = 0b0001000;
export const Ref = 0b0010000;

export const Visibility = 0b0100000;
// catch something
export const DidCapture = 0b1000000;
// should caught but not caught in unwind
export const ShouldCapture = 0b1000000000000;

// When commitWork will be triggered
export const MutationMask =
  Placement | Update | ChildDeletion | Ref | Visibility;
export const LayoutMask = Ref;

// When useEffect will be triggered
// 1. passive effect：
// 2. child deletion: when <App/>is unmounted,the cb in return of useEffect should be executed.
export const PassiveMask = PassiveEffect | ChildDeletion;

export const HostEffectMask =
  MutationMask | LayoutMask | PassiveMask | DidCapture;
