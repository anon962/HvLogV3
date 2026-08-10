import { Result } from "myutils"
import { L } from "myutils"

export interface ParseError {
    detail: string
}

export class EventParser<
    TSchema extends ParserSchema = any,
    TName extends string = string,
> {
    patt: RegExp

    constructor(
        public name: TName,
        raw_patt: string,
        public schema: TSchema,
    ) {
        this.patt = new RegExp("^" + raw_patt + "$")

        // @todo: move to test
        // this.groupCount =
        //     new RegExp(this.patt.toString() + "|").exec("")!.length -
        //     1
        // if (this.groupCount !== this.types.length)
        //     throw Error(this.name)
    }

    parse(
        line: string,
    ): Result<BaseHvEvent<TSchema, TName> | null, ParseError> {
        const match = this.patt.exec(line)
        if (match === null) {
            return [null, null]
        }

        try {
            const result = Object.entries(this.schema).reduce(
                (ev, [k, term]) => {
                    const d = match.groups?.[k]

                    if (d === undefined) {
                        if (!term.isOptional) {
                            const msg = `Schema property ${k} for event ${this.name} was not captured in ${this.patt}. Line ${line}`
                            L.error(line)
                            L.error(msg)
                            throw new Error(msg)
                        }

                        // @ts-ignore
                        ev[k] = d
                    } else {
                        let converter
                        switch (term.type) {
                            case "string":
                                converter = String
                                break
                            case "number":
                                converter = Number
                                break
                            case "boolean":
                                converter = Boolean
                                break
                        }

                        // @ts-ignore
                        ev[k] = converter(d)
                        if (converter === Number && isNaN(ev[k] as any)) {
                            throw new Error(
                                `NaN for ${k} in event ${this.name} from raw value ${d}. Source ${this.patt.source}. Line ${line}`,
                            )
                        }
                    }

                    return ev
                },
                { event_type: this.name } as BaseHvEvent<TSchema, TName>,
            )

            return [result, null]
        } catch (e) {
            return [null, { detail: String(e) }]
        }
    }
}

export class SchemaTerm<
    TType extends "string" | "number" | "boolean" =
        | "string"
        | "number"
        | "boolean",
    TOptional extends boolean = boolean,
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
    type: TType,
): SchemaTerm<TType, false> {
    return new SchemaTerm(type)
}

export type ParserSchema = Record<string, SchemaTerm>

export type BaseHvEvent<
    TSchema extends ParserSchema = ParserSchema,
    TName extends string = string,
> = {
    event_type: TName
} & {
    [K in keyof TSchema]: ReadOptionalProp<ReadTypeProp<TSchema[K]>, TSchema[K]>
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
