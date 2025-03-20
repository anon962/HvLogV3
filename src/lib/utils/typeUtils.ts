export type Result<TOk, TError> = [TOk, null] | [null, TError]

export type ValueOf<T extends Record<any, any>> = T[keyof T]
