import { ISODate, uuidWithFallback } from "myutils"
import { SearchSummary } from "../stats/summary"
import { BaseHvEvent } from "../utils/eventParser"
import { MetaSummary } from "../stats/metaStats"
import { UserscriptConfig } from "./userscriptConfig"
import { EquipPageN } from "../ui/hvlog/equipsPage"

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
        startedAt: ISODate
        endedAt: ISODate
        world: HvWorld
        user_id: string | null
        user_name: string | null
        errors: {
            missingTurns: boolean
        }
        reversed?: {
            at: ISODate
            version: "v2"
        }
    }

    //
    //
    //

    export type HvLogLive = {
        current: null | {
            id: LogId
            startedAt: ISODate
            updatedAt: ISODate
            turnCount: number
            prevTurn: null | {
                first: string
                length: number
            }
        }
        complete: Record<
            LogId,
            {
                id: LogId
                turnCount: number
                startedAt: ISODate
                endedAt: ISODate
            }
        >
    }
    export interface LocalStorageSchema {
        hvlog_live: HvLogLive
        hvlog_live_isekai: HvLogLive
    }
    export function writeLocalStorage<Key extends keyof LocalStorageSchema>(
        k: Key,
        v: LocalStorageSchema[Key],
    ) {
        localStorage.setItem(k, JSON.stringify(v))
    }
    export function readLocalStorage<Key extends keyof LocalStorageSchema>(
        k: Key,
        parse: (raw: string) => LocalStorageSchema[Key],
    ): LocalStorageSchema[Key] | null {
        const raw = localStorage.getItem(k)
        if (raw === null) {
            return null
        }
        return parse(raw)
    }

    export interface IdbSchema {
        kv: {
            config: UserscriptConfig
            prices: DbN.Prices
            compressDone: Set<LogId>
            equipTally: {
                version: number
                done: Set<LogId>
                equips: Uint8Array<ArrayBuffer>
                pending: boolean
            }
        }
        live: Record<`${LogId}_${number}`, { logId: LogId; lines: string[] }>
        logsMeta: Record<
            LogId,
            LogMeta & {
                id: LogId
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
        /** @deprecated */
        live_meta: Record<string, any>
        /** @deprecated */
        live_hash: Record<string, any>
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
