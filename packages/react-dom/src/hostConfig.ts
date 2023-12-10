import { Props } from "./../../shared/ReactTypes";
import { FiberNode } from "react-reconciler/src/fiber";
import { HostComponent, HostText } from "react-reconciler/src/workTags";
import { updateFiberProps } from "./SyntheticEvents";
import { DOMElement } from "./SyntheticEvents";

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

// the DOM created was not usual DOM, it exstends from Element
export const createInstance = (type: string, props: Props): Instance => {
  const element = document.createElement(type) as unknown;
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memorizedProps?.content;
      return commitTextUpdate(fiber.stateNode, text);
    case HostComponent:
      return updateFiberProps(fiber.stateNode, fiber.memorizedProps);
    default:
      if (__DEV__) {
        console.warn("commitUpdate did not implement the type: " + fiber.tag);
      }
      break;
  }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content;
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  container.removeChild(child);
}

export function insertChildToContainer(
  child: Instance | TextInstance,
  container: Container,
  before: Instance | TextInstance | null
) {
  container.insertBefore(child, before);
}

export const scheduleMicroTask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof Promise === "function"
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;

export function hideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style;
  style.setProperty("display", "none", "important");
}

export function unhideInstance(instance: Instance) {
  const style = (instance as HTMLElement).style;
  style.display = "";
}

export function hideTextInstance(textInstance: TextInstance) {
  textInstance.nodeValue = "";
}

export function unhideTextInstance(textInstance: TextInstance, text: string) {
  textInstance.nodeValue = text;
}
