import { ISODate } from "myutils"
import { BaseHvEvent } from "../utils/eventParser"

export type LogEntry<TEvent extends BaseHvEvent = BaseHvEvent> =
    | { type: "event"; event: TEvent }
    | { type: "error"; detail: string; line: string }
export type LogEntries<T extends BaseHvEvent = BaseHvEvent> = Array<LogEntry<T>>

export namespace DbN {
    export type LogId = string
    export type HvWorld = "persistent" | "isekai"
    export type Prices = Record<string, number>

    export type Log = {
        id: LogId
        meta: LogMeta
        compressed: 0
        raw: string
        raw_c: null
    }

    export interface LogMeta {
        start: ISODate
        lastUpdate: ISODate
        version: number
        world: HvWorld
        user_id: string | null
        user_name: string | null
    }

    //
    //
    //

    export interface Schema {
        kv: {
            toCompress: string[]
        }
        logsMeta: Record<LogId, LogMeta & { id: string }>
        logsRaw: Record<
            LogId,
            | {
                  id: LogId
                  compressed: 0
                  raw: string
                  raw_c: null
              }
            | {
                  id: LogId
                  compressed: number
                  raw: null
                  raw_c: Uint8Array<ArrayBuffer>
              }
        >
        live: Record<number, { logId: LogId; lines: string[] }>

        /** @deprecated */
        complete: Record<string, any>
    }
}
