export class SchemaTerm<
    TType extends "string" | "number" | "boolean" =
        | "string"
        | "number"
        | "boolean",
    TOptional extends boolean = boolean
> {
    // @ts-ignore
    isOptional: TOptional = false

    constructor(public type: TType) {}

    optional(): SchemaTerm<TType, true> {
        // @ts-ignore
        this.isOptional = true

        // @ts-ignore
        return this
    }

    required(): SchemaTerm<TType, false> {
        // @ts-ignore
        this.isOptional = false

        // @ts-ignore
        return this
    }
}
export function t<TType extends "string" | "number" | "boolean">(
    type: TType
): SchemaTerm<TType, false> {
    return new SchemaTerm(type)
}

export type ParserSchema = Record<string, SchemaTerm>

export type HvEvent<
    TSchema extends ParserSchema = ParserSchema,
    TName extends string = string
> = {
    event_type: TName
} & {
    [K in keyof TSchema]: ReadOptionalProp<
        ReadTypeProp<TSchema[K]>,
        TSchema[K]
    >
}

// prettier-ignore
type ReadTypeProp<T extends SchemaTerm> = 
    T extends SchemaTerm<infer TType> ?
        TType extends 'string' ? string :
        TType extends 'number' ? number :
                                boolean :
    never

// prettier-ignore
type ReadOptionalProp<T extends any, TTerm extends SchemaTerm> =
    TTerm extends SchemaTerm<any, infer TOptional> ?
        TOptional extends true ?
            T | null :
            T :
    never
