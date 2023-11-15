import { REACT_ELEMENT_TYPE } from "../../shared/ReactSymbol";
import {
  ElementType,
  Key,
  Ref,
  Props,
  ReactElementType,
} from "../../shared/ReactTypes";

// console.log(<div a=1 key={1}>1<div>2</div></div>)
// {
//     $$typeof: Symbol(react.element),
//     type: "div",
//     key: "1",
//     ref: null,
//     props: {
//         a: 1,
//     }
// }
const ReactElement = function (
  type: ElementType,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    // $$typeof is for preventing the XSS attacks
    $$typeof: REACT_ELEMENT_TYPE,
    type: type,
    key: key,
    ref: ref,
    props: props,
    __mark: "ddeng36",
  };
  return element;
};

// <div id = "1" a = "1" key="1" ref={null}>
//   	123
// 	<p id = "2" a = "2" key="2" ref={null}>
//       456
//   	</p>
// </div>
// would be compiled to:
// import { jsx as _jsx } from "react/jsx-runtime";
// import { jsxs as _jsxs } from "react/jsx-runtime";
// /*#__PURE__*/_jsxs("div", {
//   id: "1",
//   a: "1",
//   ref: null,
// There is no child when empty content in div
//   children: ["123", /*#__PURE__*/_jsx("p", {
//     id: "2",
//     a: "2",
//     ref: null,
//     children: "456"
//   }, "2")]
// }, "1");

export const jsx = function (
  type: ElementType,
  config: any,
  ...maybeChildren: any
) {
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};
  for (const prop in config) {
    const value = config[prop];
    // turn key into string if it exist
    if (prop === "key") {
      if (value !== undefined) {
        key = "" + value;
      }
    }
    // if not exist then turn ref into null
    else if (prop === "ref") {
      if (value !== undefined) {
        ref = value;
      }
    } else {
      // turn all other props into props object
      // if this prop is not from prototype, this prop is from config object its'self
      // then add it to props object
      if (Object.hasOwnProperty.call(config, prop)) {
        props[prop] = value;
      }
    }
  }
  // deal with children, make sure it is an array or null
  const childrenLength = maybeChildren.length;
  if (childrenLength === 1) {
    props.children = maybeChildren[0];
  } else {
    props.children = maybeChildren;
  }

  return ReactElement(type, key, ref, props);
};

// jsxDEV is different from jsx, it is used for development mode
// here we just assume they are same
export const jsxDEV = function (type: ElementType, config: any) {
  let key: Key = null;
  let ref: Ref = null;
  const props: Props = {};
  for (const prop in config) {
    const value = config[prop];
    // turn key into string if it exist
    if (prop === "key") {
      if (value !== undefined) {
        key = "" + value;
      }
    }
    // if not exist then turn ref into null
    else if (prop === "ref") {
      if (value !== undefined) {
        ref = value;
      }
    } else {
      // turn all other props into props object
      // if this prop is not from prototype, this prop is from config object itsself
      // then add it to props object
      if (Object.hasOwnProperty.call(config, prop)) {
        props[prop] = value;
      }
    }
  }

  return ReactElement(type, key, ref, props);
};
