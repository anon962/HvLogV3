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
        compressed: false
        raw: string
        raw_c: null
    }

    export type CompressedLog = Omit<Log, "compressed" | "raw" | "raw_c"> & {
        compressed: true
        raw: null
        raw_c: Uint8Array<ArrayBuffer>
    }

    export interface LogMeta {
        start: ISODate
        lastUpdate: ISODate
        version: number
        world: HvWorld
        user_id: string | null
        user_name: string | null
    }

    type WithPartialMeta<T extends Log | CompressedLog> = Omit<T, "meta"> & {
        meta: Omit<LogMeta, "version">
    }
    export type IdbLogRow = WithPartialMeta<Log | CompressedLog>

    export interface Schema {
        logs: Record<LogId, IdbLogRow>
        logVersions: Record<LogId, number>
        kv: {
            toCompress: string[]
        }
        live: Record<
            number,
            { logId: LogId; entries: LogEntry[]; isMaybeDupe: boolean }
        >

        /** @deprecated */
        complete: Record<string, any>
    }
}
