import { Container } from "hostConfig";
import { Props } from "./../../shared/ReactTypes";
import {
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_runWithPriority,
  unstable_UserBlockingPriority,
} from "scheduler";

export const elementPropsKey = `__props`;
const validEventTypeList = ["click"];

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

//dom[xxx] = reactElement.props
export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn(`invalid event type: ${eventType}`);
    return;
  }
  if (__DEV__) {
    console.log(`initEvent: ${eventType}`);
  }
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  const originStopPropagation = e.stopPropagation;
  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation.call(e);
    }
  };
  return syntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;
  if (targetElement === null) {
    console.warn(`targetElement is null`, e);
    return;
  }
  // 1. gather event along the path
  const { bubble, capture } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );

  // 2. create synthetic event
  const syntheticEvent = createSyntheticEvent(e);

  //3. trigger capture phase
  triggerEventFlow(capture, syntheticEvent);
  // 4. trigger bubble phase
  if (!syntheticEvent.__stopPropagation) {
    triggerEventFlow(bubble, syntheticEvent);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    // call scheduler to run cb with priority
    unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
      callback.call(null, se);
    });
    if (se.__stopPropagation) {
      break;
    }
  }
}
function getEventCallbackNameFromEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ["onClickCapture", "onClick"],
  }[eventType];
}

function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const paths: Paths = {
    capture: [],
    bubble: [],
  };
  while (targetElement && targetElement !== container) {
    // gathering
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      // click -> onClick onClickCapture
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              // capture
              paths.capture.unshift(eventCallback);
            } else {
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return paths;
}
function eventTypeToSchedulerPriority(eventType: string) {
  switch (eventType) {
    case "click":
    case "keydown":
    case "keyup":
      return unstable_ImmediatePriority;
    case "scroll":
      return unstable_UserBlockingPriority;
    default:
      return unstable_NormalPriority;
  }
}
