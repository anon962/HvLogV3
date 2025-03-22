export type Result<TOk, TError> = [TOk, null] | [null, TError]

export type ValueOf<T extends Record<any, any>> = T[keyof T]

export type AnyFunction = (...args: any[]) => any

// prettier-ignore
export type EventMapFor<T extends Window | Document | HTMLElement> =
    T extends Window ? WindowEventMap :
    T extends Document ? DocumentEventMap : 
    T extends HTMLElement ? HTMLElementEventMap
    : never
