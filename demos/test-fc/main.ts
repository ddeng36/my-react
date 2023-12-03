import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_LowPriority as LowPriority,
  unstable_IdlePriority as IdlePriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
  CallbackNode,
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_cancelCallback as cancelCallback,
} from "scheduler";

const button = document.querySelector("button");
const root = document.querySelector("#root");

type Priority =
  | typeof IdlePriority
  | typeof LowPriority
  | typeof NormalPriority
  | typeof UserBlockingPriority
  | typeof ImmediatePriority;

interface Work {
  count: number;
  priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
  (priority) => {
    const btn = document.createElement("button");
    root?.appendChild(btn);
    btn.innerText = [
      "",
      "ImmediatePriority",
      "UserBlockingPriority",
      "NormalPriority",
      "LowPriority",
    ][priority];
    btn.onclick = () => {
      workList.unshift({
        count: 100,
        priority: priority as Priority,
      });
      schedule();
    };
  }
);

function schedule() {
  const cbNode = getFirstCallbackNode();
  // sort WorkList
  const curWork = workList.sort((a, b) => a.priority - b.priority)[0];

  // if no work
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }

  // if same priority, do nothing
  const { priority: curPriority } = curWork;
  if (curPriority === prevPriority) {
    return;
  }

  // if work with higher proirity, cancel current callback, and schedule new callback
  cbNode && cancelCallback(cbNode);
  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
  // 1. work priority
  // 2. starvation problem(internal scheduleCallback)
  // 3. time slicing
  const needSync = work.priority === ImmediatePriority || didTimeout;
  // when to execute
  while ((needSync || !shouldYield()) && work.count > 0) {
    work.count--;
    insertSpan(work.priority.toString());
  }

  // interrupt or execute finished
  prevPriority = work.priority;
  // if work is finished, remove it from workList and update prevPriority
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    prevPriority = IdlePriority;
  }

  // when there is a interrupt, the prev and new cb are different
  const prevCallback = curCallback;
  schedule();
  const newCallback = curCallback;
  // continue to execute when prev === new
  if (newCallback && prevCallback === newCallback) {
    return perform.bind(null, work);
  }
}

function insertSpan(content) {
  const span = document.createElement("span");
  span.innerText = content;
  span.className = `pri-${content}`;
  doSomeBuzyWork(10000000);
  root?.appendChild(span);
}

function doSomeBuzyWork(len: number) {
  let result = 0;
  while (len--) {
    result += len;
  }
}
