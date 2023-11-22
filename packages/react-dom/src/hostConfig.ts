export type Container = Element;
export type Instance = Element;


export const createInstance = (type:string,) => {
    //TODO deal with props
    const element = document.createElement(type);
    return element;
}

export const appendInitialChild = (
    parent: Instance | Container,
    child: Instance
) => {
    parent.appendChild(child);
}
export const createTextInstance = (content: string) => {
    return document.createTextNode(content);
}
export const appendChildContainer = (
    parent: Instance | Container,
    child: Instance
) => {
    parent.appendChild(child);
}