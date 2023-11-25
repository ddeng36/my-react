import { ReactElementType } from 'shared/ReactTypes';
// ReactDOM.createRoot(root).render(<App />)
import { createContainer, updateContainer } from "react-reconciler/src/fiberReconciler";
import { Container } from "./hostConfig";
export function createRoot(container:Container) {
    const root = createContainer(container);
    return {
        render(element: ReactElementType) {
            // this ele
            return updateContainer(element, root);
        }
    }
}