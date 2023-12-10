import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable,
} from "shared/ReactTypes";

export const SuspenseException = new Error("a part of work of Suspense");

let suspendedThenable: Thenable<any> | null = null;

export function getSuspenseThenable(): Thenable<any> {
  if (suspendedThenable === null) {
    throw new Error("bug");
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case "fulfilled":
      return thenable.value;
    case "rejected":
      throw thenable.reason;
    default:
      if (typeof thenable.status === "string") {
        thenable.then(noop, noop);
      } else {
        // untracked
        const pending = thenable as unknown as PendingThenable<T, void, any>;
        pending.status = "pending";
        pending.then(
          (val) => {
            if (pending.status === "pending") {
              // @ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending;
              fulfilled.status = "fulfilled";
              fulfilled.value = val;
            }
          },
          (err) => {
            if (pending.status === "pending") {
              // @ts-ignore
              const rejected: RejectedThenable<T, void, any> = pending;
              rejected.reason = err;
              rejected.status = "rejected";
            }
          }
        );
      }
  }
  suspendedThenable = thenable;
  throw SuspenseException;
}
