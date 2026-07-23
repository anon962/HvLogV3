import { BaseHvEvent } from "../eventParser"

export type HvWorld = "persistent" | "isekai"

export type LogId = string
export type ISODate = string

export interface LogMeta {
    start: ISODate
    lastUpdate: ISODate
    version: number
    world: HvWorld
    user_id: string | null
    user_name: string | null
}

export interface CompleteLog<T extends BaseHvEvent = BaseHvEvent> {
    id: LogId
    meta: LogMeta
    entries: Array<LogEntry<T>>
}

export type LogEntry<TEvent extends BaseHvEvent> =
    | { type: "event"; event: TEvent }
    | { type: "error"; detail: string }
