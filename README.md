
# File & Directory
    -/packages

        -/react : environment unrelated  public methods.

        -/react-reconciler : environment unrelated, Implementation of reconciler.

        -/shared : environment unrelated public utils methods




1.  理念
  - 函数式编程
    - UI = f(state)
    - 数据驱动视图
    - OOP的react需要关注生命周期，而FP的react只需要关注纯函数和副作用
  - 架构
    - Scheduler(16新增)：调度任务优先级，高优先级先进入Reconciler。
    - Reconciler(16重构)：VDOM实现，计算UI变化。
      - 突破CPU/IO瓶颈：可中断，可分片任务，可并行，StackReconciler -> FiberReconciler
      - 双缓存更新。
    - Renderer：将UI渲染到真实宿主环境
  - 优化
    - Js
      - 闭包，事件委托，事件捕获冒泡，事件轮询，深浅拷贝，promise
    - 工具
      - vite，rollup，jest
    - 设计模式
      - 组合模式：FN
      - 订阅发布模式：useEffect，useState
      - 观察者模式： Context
      - 原型模式：beginWork中useFiber拷贝生成对象
      - Props
      - HOC
    - 数据结构
      - LinkedList：Hooks环状链表，Effect环状链表
      - Stack：context，SyntheticEvent的path
      - Queue：UpdateQueue，SyncTaskQueue
      - Tree：FiberNode
      - Map: 多节点diff
      - Heap: scheduler里面的task
    - 算法
      - DFS，BFS，diff（单点，多点），位运算（FiberFlags，HooksEffectTag，Lanes），并发更新
  - 流程
    - schedule阶段
    - render阶段（可打断）
      - beginWork
      - completeWork
    - commit阶段（不可打断）
2. 架构
Render阶段(Reconciler，可打断)
    - 工作流程
React.createRoot(root).append(<App/>)
function APP(){
    return(
        <div>
            // div的child只指向第一个孩子
            Hello
            // Hello的sibling单向指向span
            // 只有唯一文本子元素的节点没有child
            // 最后一个sibling才有return指向父节点
            <span>World</span>
        </div>
    )
}
递： beginWork，如果有child，一直访问child。如果没有child，则调用归。
归：completeWork，如果有sibling，则访问sibling。如果没有，则把currentNode设置成父节点。
// HostRootFiber -> beginWork() -> 有child，生成App
// App -> beginWork() -> 有child，生成div
// div -> beginWork() -> 有child，生成'Hello', span
// 'Hello' -> beginWork() -> 无child，调用completeWork()。同时生成叶子元素。
// 'Hello' -> completeWork() -> 有sibling，访问sibling，并调用其beginWork()
// span -> beginWork() -> 无child，调用completeWork()。同时生成叶子元素
// span -> completeWork() -> 无sibling，则把currentNode设置成父节点
// div -> completeWork() -> 无sibling，则把currentNode设置成父节点
// App -> completeWork() -> 无sibling，则把currentNode设置成父节点
// HostRootFiber -> completeWork() -> 无sibling，则把currentNode设置成父节点
This content is only supported in a Feishu Docs
    - beginWork
      - 流程
        1. 根据不同的tag来执行不同的操作（比如FC需要加载Hook，text则直接返回）。
        2. 调用reconcileChildren，此时判断是否追踪副作用。
        3. 判断diff算法，是单节点reconcileSingleElement还是多节点reconcileChildArray。
        4. 生成子节点的FN并返回。
This content is only supported in a Feishu Docs
      - 第一次挂载就是mount，如果之前current!==null，则为update。但如果进入update流程后发现不可复用该节点，相当于重新创建FN并mount。
      - ChildReconciler返回的是下一级子节点，该方法会根据current来判断是否需要追踪Effect来标记flag
      - ChildReconciler工作方式
This content is only supported in a Feishu Docs
// 1. 挂载div
// RE: div , FN: null ->  Flags: Placement
// 2. div换成p
// RE: p, FN: div -> Flags: Deletion, Placement
    - completeWork
      - 流程
        - 判断tag时，如果是fragment，FC，Root等会直接进入冒泡
        - 相比于执行5次Placment，我们可以构建好「离屏DOM树」后，对div执行1次Placement操作
This content is only supported in a Feishu Docs
Commit阶段(Renderer，不可打断)
    - 流程
This content is only supported in a Feishu Docs
    - beforeMutation阶段
    - mutation阶段
      - 需要找到第一个flag不为0的FN然后开始更新。会首先把当前finishedwork变成DOM，然后插入到root里面。
      - 在complete阶段也会实例化dom并且插入container，但是这里只是在FN层面上操作，并不在UI中显示。
    - layout阶段
      - layout和mutation阶段中间把root.current切换成了fiberTree，所以mutation完成时，还是上一次的UI树，直到layout才进入UI树切换
Schedule阶段(Scheduler)
    - 流程
      1. work统一放入Heap中
      2. 每次schedule()选出优先级最高的一个work。
      3. 根据情况判断是否执行该work。
        1. 如果null，则停止。
        2. 如果相同优先级或更低优先级，则执行原来的work。
        3. 如果有更高优先级，中断原来的work，并执行新的高优先级work。
      4. 开始执行，调用perform()
      5. 执行任务至完成，则从workList中清除该work
      6. 如果该任务中断，则先执行高优任务，结束后继续执行
[Image]
3. 实现
JSX，RE，FN，DOM
    - JSX会变成什么？
This content is only supported in a Feishu Docs
// <div>123</div> jsx会变成什么 => 方法 =>ReactElement
// https://babeljs.io/repl#?browsers=defaults&build=&builtIns=false&corejs=3.6&spec=false&loose=false&code_lz=DwEwlgbgfAjATAZmAenNAUEA&debug=false&forceAllTransforms=false&modules=false&shippedProposals=false&circleciRepo=&evaluate=true&fileSize=false&timeTravel=false&sourceType=module&lineWrap=true&presets=react%2Cstage-2&prettier=false&targets=&version=7.19.5&externalPlugins=&assumptions=%7B%7D
// jsx到以下代码的过程为编译时，已经由Babel实现

// classic 17之前的版本
// type, props, children
/*#__PURE__*/React.createElement("div", null, "123");

// runtime 18
// type,{props}
import { jsx as _jsx } from "react/jsx-runtime";
/*#__PURE__*/_jsx("div", {
  children: "123"
});

// my-react 中，React.createElement() ，jsx，jsxDEV三个函数指向同一个方法
export default {
    version: "0.0.0",
    createElement: jsxDEV
};

    - 为什么需要这么多数据结构？
      - JSX无法记忆状态。
      - ReactElement无法比较sibling和parent，而且状态太少。
      - FiberNode(即VDOM)可以比较parent,chidren,siblings，有静态属性，也有工作属性。
    - Fiber架构
      - 节点类型
//React Component
const App = () => { return (<div>Hello</div>) }
//React Element
const ele = <App/>
//FiberNode
ReactDOM.createRoot(root).render(ele)
      - 双缓存机制
        - 架构中存在两颗FiberTree，真实UI对应的是current，内存中构建的对应的是WIP
Update机制
    - 触发更新方式
      - ReactDOM.createRoot().render（或老版的ReactDOM.render） 
      - useState的dispatch方法
      - 注意，更新流程从根结点开始！！！
[Image]
    - Update更新机制
updateQueue: 
    dispatch: null
    // fiber.updateQueue.lastEffect为最后一个state
    lastEffect: {tag: 3, destroy: undefined, deps: Array(0), next: {…}, create: ƒ}
    shared: {pending: null}
      - 代表更新的数据结构：Update。Update.action 里面放的是常量或者回调函数。
      - 消费Update的数据结构：UpdateQueue。UpdateQueue.shared.pending指向Update。
Hooks架构
    函数组件的memoizedState为hooks链表，Hook内部又存在着自己的memoizedState和UpdateQueue，同时通过next形成链表。
fiber.memoizedState保存的是Hooks
// Hook内部结构
UpdateQueue: // 三个setState批处理
    dispatch: ƒ ()
    shared: 
        pending: 
            action: (num2) => num2 + 3
            lane: 1
            next: 
                action: (num2) => num2 + 1
                lane: 1
                next: 
                    action: (num2) => num2 + 2
                    lane: 1
                    next: {lane: 1, next: {…}, action: ƒ}
// 保存Hooks特有的数据结构，useState保存的是当前值，useEffect保存的是effect
memorizedState: 0 
next: null // Hooks串联成链表
[Image]
SyntheticEvent事件机制
    - 流程
      1. render()时，将原生事件注册到#root元素上。所有触发的事件，都由#root元素来代理，这一过程称之为事件委托机制
      2. 寻找触发事件元素
      3. 从子节点依次向上收集事件，把回调函数存入path
      4. 将path中的事件变成合成事件，标记是否stopPropogation
      5. 依次trigger path中的回调函数（对于useState为dispatch），先反向遍历执行cap模拟捕获，再正向执行bubble模拟冒泡
Diff算法
    - 单节点diff
「单/多节点」是指「更新后是单/多节点」，分为4类，只有key和type都相同才可以复用
    key相同，type相同，可以复用
    A1,B2,C3 -> A1
    
    key相同，type不同，不可复用
    A1,B2,C3 -> B1
    
    key不同，type相同，不可复用
    A1,B2,C3 -> A2
    
    key不同，type不同，不可复用
    A1,B2,C3 -> D2

    - 多节点diff
// 1.遍历current的所有同级FN，并放在map中
// 2.遍历所有element，并对比，map中是否存在可复用节点（key，type相同）
// 3.若果存在，移动或插入该节点，并从map中移除
      // 3. move or insert flags?
      // lastPlacedIndex -> currentIdx
      // A1,B2,C3 -> B2,C3,A1
      // 0 ,1 ,2  -> 0 ,1 ,2
      // 1. currentNode: B2, currentIdx: 0, lastPlacedIndex: 0
      //    currentIdx >= lastPlacedIndex, so don't need to move
      // 2. currentNode: C3, currentIdx: 1, lastPlacedIndex: 1
      //    currentIdx >= lastPlacedIndex, so don't need to move
      // 3. currentNode: A1, currentIdx: 2, lastPlacedIndex: 0
      //    currentIdx < lastPlacedIndex, so need to move
      
      // if A1,A2,A3 -> A3,A2,A1
      // every time, lastPlacedIndex is equal to currentIdx
      // so don't need to move or insert, just enqueue to update content

// 4.删除map中剩余的节点
Lane模型
[Image]
useState
    - 流程
      - 初始化
      1. 当FC类型的FN调用renderWithHooks时，会进入FC函数，此时判断是mountState还是updateState
      2. 如果是mountState，则按照参数初始化num，并回传[num,setNum]
      3. 如果是updateState，则利用processQueue更新num，并回传新的[num,setNum]
      4. 继续遍历Hooks并形成环状链表
      - 调用
      1. 异步：事件触发setState的dispatch方法，把当前更新enqueueUpdateQueue，并形成环状链表，以便batchUpdate。
      2. dispatchSetState完了之后，会把renderRoot放在microTask队列中。
      3. 同步：当beginWork更新FC时，会触发processUpdateQueue，并同步将所有的setState一次更新完。
useEffect
    - 流程
      - 初始化
      1. 当FC类型的FN调用renderWithHooks时，会进入FC函数，此时判断是mountEffect还是updateEffect。
      2. 如果是mountEffect,则只考虑当前回合update，因为mountEffect只会在mount时执行，所以只会有create
      3. 如果是updateEffect，则会考虑上一回合的unmount和本回合的update。
      4. 将update和unmount(各自有create和destroy,且要考虑deps是否相等)都存入root.lastEffect
      5. 继续遍历Hooks并形成环状链表
      - 调用
      1. 当commitRoot时，commitMutation会先自顶向下到达发生副作用的节点，然后自底向上到达根节点，所以会先到达Child然后才是App，沿路收集所有副作用。最后，通过scheduler的宏任务执行，所以会在setState之后，因为setState是microTask
      2. 开始flush，并遍历effect
      3. 首先出发上回合的unmount的destroy
      4. 触发上回合的update的destroy
      5. 触发本回合的update的create
[Image]
    - 数据结构
[Image]
const effect = {// 存储在memoizedstate里面
    tag,
    create,// mount时和deps变化时触发该回调
    destroy,
    deps,// 依赖
    next// 当前FC的其他effects，并形成环状链表。
        //fiber.updateQueue.lastEffect为最后一个state
}
function App() {
    useEffect(() => {
        // create
        return () => {
            // destroy
        }
    }, [xxx, yyy])
    
    useLayoutEffect(() => {})
    useEffect(() => {}, [])
    
    // ...
}
    - 区别
      - useEffect异步
      - useLayoutEffect，useInsertionEffect同步
useTransition
    - 触发并发更新
https://react.dev/reference/react/useTransition
// 切换UI -> 触发更新 -> 先显示旧UI -> 更新完毕后切换成新UI
// 1. 将渲染UI变得non-blocking，responsive。也就是说开启并发模式，因为18默认是同步模式的
// 2. isPending可以作为boolean用来判断渲染组件时机
// 3. 将触发更新的setState放入startTransition中，来并发更新
function TabContainer() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');

  function selectTab(nextTab) {
    startTransition(() => {
      setTab(nextTab);
    });
  }
  // ...
}
    - 流程
[Image]
use
    suspense组件用来包裹需要被懒加载的组件，比如用到useTransition,use,lazy和ssr的组件。
    use的参数可以是promise任务或者Context
    - 流程
      - 初始化
      1. use的mount和update指向的是同一个函数，该函数会给予promise创造能够与react一起工作的promise。
      - 调用
      1. 调用时，会挂起当前的render流程
      2. 进入挂起流程的render（loading...）
      3. 当请求返回后，use中的异步任务会ping，并回到主线render
useRef
    - 流程
      - 初始化
      1. 可以选择用useRef()，也可以在jsx中直接在ref内写cb
      - 调用
      1. beginWork时，根据情况标记Ref（1.mount时该div存在ref，2.update时ref变化）
      2. Commit的Mutation阶段时，调用detach方法，传入值为null
        1. 如果ref={inputRef}，则将ref.current = null
        2. 如果ref={(dom) => console.warn(dom)}，则执行ref(null)，相当于(null) => console.warn(null)
      3. Commit的Layout阶段时，调用attach方法，传入值为fiber.stateNode。（一次commit中相当于执行了两次ref）
// 1.通过ref来直接操作DOM元素
// 2.保存渲染无关值，改变ref不触发re-render
```
import { useRef } from 'react';

export default function Form() {
  const inputRef = useRef(null);

  function handleClick() {
    // 直接调用input的focus方法
    inputRef.current.focus();
  }

  return (
    <>
      <input ref={inputRef} />
      <p ref={(dom) => console.warn('dom is:', dom)}>
          Child
      </p>
      <button onClick={handleClick}>
        Focus the input
      </button>
    </>
  );
}
```
useContext
    - 流程
      - 初始化
      1. 调用createContext生成ctx变量。
      2. 使用<ctx.Provider>组件包裹子组件。
      3. beginWork时的renderWithHooks时，将provider入stack。
      4. completeWork时，将provider出stack，由此保证了层级数据一致性。
      - 调用
      1. 在子组件中使用useContext(ctx)获取ctx中的__value值
      由于useContext没有使用Hooks架构，所以可以在if里定义，但是，必须在<Provider>中调用
