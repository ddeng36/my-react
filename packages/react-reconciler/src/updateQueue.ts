import { Action } from "../../shared/ReactTypes";

export interface Update<State> {
    action : Action<State>,
}

export interface UpdateQueue<State> {
    shared :{
        pending: Update<State> | null;
    }
};

export const createUpdate = <State> (action : Action<State>) : Update<State> => {
    return {
        action
    };
}

export const createUpdateQueue = <Action> ()  => {
    return {
        shared: {
            pending: null
        }
    } as UpdateQueue<Action>;
}

export const enqueueUpdateQueue = <State> (updateQueue : UpdateQueue<State>, Update : Update<State>) => {
    updateQueue.shared.pending = Update;
}

export const processUpdateQueue = <State> (baseState : State, pendingState : Update<State> | null ) : {memorizedState : State} => {
    const result: ReturnType<typeof processUpdateQueue<State>> = {memorizedState: baseState};

    if(pendingState !== null) {
        const action = pendingState.action;
        if(action instanceof Function){
            // if pendingState is function, then call the function
            result.memorizedState = action(baseState);
        }
        else{
            // if pendingState is primitive type, then assign it directly
            result.memorizedState = action;
        }

    }
    return result;
}