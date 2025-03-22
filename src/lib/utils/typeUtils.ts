export type Result<TOk, TError> = [TOk, null] | [null, TError]

export type ValueOf<T extends Record<any, any>> = T[keyof T]

export type AnyFunction = (...args: any[]) => any

// prettier-ignore
export type EventMapFor<T extends Window | Document | HTMLElement> =
    T extends Window ? WindowEventMap :
    T extends Document ? DocumentEventMap : 
    T extends HTMLElement ? HTMLElementEventMap
    : never

// prettier-ignore
export type InferCollectionType<T extends Set<unknown> | Array<unknown>> =
    T extends Set<infer V> ? V :
    T extends Array<infer V> ? V :
    never

// prettier-ignore
export type InferGuardType<T> = 
    T extends (x: any) => x is infer V ? V : never

export type Or<A, B> = A extends never ? B : A
