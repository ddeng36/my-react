export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextProvider
  | typeof SuspenseComponent
  | typeof OffscreenComponent;

// rafce
export const FunctionComponent = 0;

// React.render();
export const HostRoot = 3;

// <div>
export const HostComponent = 5;

// 123
export const HostText = 6;

// <>
export const Fragment = 7;

export const ContextProvider = 8;

export const SuspenseComponent = 13;
export const OffscreenComponent = 14;
