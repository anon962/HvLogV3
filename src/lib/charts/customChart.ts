import { HvEvent } from "../parsers"

export interface CustomChart {
    id: string

    attach(el: HTMLElement): this

    append(ev: HvEvent, round: number): this
    clear(): this

    load(data: any): this
    save(): any
}
