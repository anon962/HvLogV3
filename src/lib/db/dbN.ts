import { ISODate, uuidWithFallback } from "myutils"
import { SearchSummary } from "../stats/summary"
import { BaseHvEvent } from "../utils/eventParser"
import { MetaSummary } from "../stats/metaStats"
import { UserscriptConfig } from "./userscriptConfig"

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
        world: HvWorld
        user_id: string | null
        user_name: string | null
    }

    //
    //
    //

    export interface LocalStorageSchema {
        hvlog_live: {
            current: null | {
                id: LogId
                roundStart: number
                roundMax: number
                battleType: string
                turnCount: number
            }
            complete: Array<{ id: LogId; turnCount: number }>
        }
    }

    export interface IdbSchema {
        kv: {
            config: UserscriptConfig
            compressDone: Array<LogId>
            prices: DbN.Prices
        }
        live: Record<`${LogId}_${number}`, { logId: LogId; lines: string[] }>
        logsMeta: Record<
            LogId,
            LogMeta & {
                id: LogId
                importedAt?: ISODate
            }
        >
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
        summariesForMeta: Record<
            LogId,
            {
                id: LogId
                version: number
                data: MetaSummary
            }
        >
        summariesForSearch: Record<
            LogId,
            {
                id: LogId
                version: number
                data: SearchSummary
            }
        >

        /** @deprecated */
        complete: Record<string, any>
    }

    const sourceId = uuidWithFallback()
    interface IdbEventRaw {
        event: IdbEvent
        sourceId: string
    }
    export function broadcastIdbEvent(event: IdbEvent) {
        const bc = new BroadcastChannel(DbN.IDB_BC_ID)
        bc.postMessage({ event, sourceId } satisfies IdbEventRaw)
        bc.close()
    }
    export function listenIdbEvent(
        onmessage: (
            ev: IdbEvent,
            opts: {
                raw: MessageEvent<IdbEventRaw>
                isSameTab: boolean
            },
        ) => void,
    ) {
        const bc = new BroadcastChannel(DbN.IDB_BC_ID)
        bc.onmessage = (raw: MessageEvent<IdbEventRaw>) =>
            onmessage(raw.data.event, {
                raw,
                isSameTab: raw.data.sourceId === sourceId,
            })
        return () => bc.close()
    }

    export const IDB_BC_ID = "hvlog"
    export type IdbEvent = IdbLogInsertEvent | IdbConfigChangeEvent
    export const IDB_LOG_INSERT_EVENT = "hvlog_log_insert"
    export type IdbLogInsertEvent = {
        type: typeof IDB_LOG_INSERT_EVENT
        world: HvWorld
        ids: Array<LogId>
    }
    export const IDB_CONFIG_CHANGE_EVENT = "hvlog_config_change"
    export type IdbConfigChangeEvent = {
        type: typeof IDB_CONFIG_CHANGE_EVENT
        config: UserscriptConfig
    }
}
