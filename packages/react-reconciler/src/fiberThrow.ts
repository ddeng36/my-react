import { Wakeable } from "shared/ReactTypes";
import { FiberNode, FiberRootNode } from "./fiber";
import { ShouldCapture } from "./fiberFlags";
import { Lane, Lanes, SyncLane, markRootPinged } from "./fiberLanes";
import { ensureRootIsScheduled, markRootUpdated } from "./workLoop";
import { getSuspenseHandler } from "./suspenseContext";

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  let pingCache = root.pingCache;
  let threadIDs: Set<Lane> | undefined;

  // WeakMap{ wakeable: Set[lane1, lane2, ...]}
  if (pingCache === null) {
    threadIDs = new Set<Lane>();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIDs);
  } else {
    threadIDs = pingCache.get(wakeable);
    if (threadIDs === undefined) {
      threadIDs = new Set<Lane>();
      pingCache.set(wakeable, threadIDs);
    }
  }
  if (!threadIDs.has(lane)) {
    // first time
    threadIDs.add(lane);

    // eslint-disable-next-line no-inner-declarations
    function ping() {
      // to trigger the update after loading
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }
      markRootUpdated(root, lane);
      markRootPinged(root, lane);
      ensureRootIsScheduled(root);
    }
    wakeable.then(ping, ping);
    // and only execute once
  }
}

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  if (
    value !== null &&
    typeof value === "object" &&
    typeof value.then === "function"
  ) {
    const weakable: Wakeable<any> = value;

    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture;
    }
    attachPingListener(root, weakable, lane);
  }
}
