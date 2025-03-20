import * as idb from "idb"
import { isEqual } from "radash"
import { HvEvent } from "./parserSchema"
import { ValueOf } from "./utils/typeUtils"

const COMPLETE_STORE = "complete"
const LIVE_STORE = "live"
const LIVE_META_STORE = "live_meta"
const LIVE_HASH_STORE = "live_hash"

export class LogDb {
    private logHashCache: LogHash | null = null

    constructor(public db: idb.IDBPDatabase<LogDbSchema>) {}

    static async init(): Promise<LogDb> {
        let didUpgrade = false
        const db = await idb.openDB<LogDbSchema>("HvLog", 1, {
            upgrade: async (db) => {
                console.debug("Initializing log db")
                db.createObjectStore(COMPLETE_STORE, {
                    autoIncrement: true,
                })
                db.createObjectStore(LIVE_STORE, {
                    autoIncrement: true,
                })
                db.createObjectStore(LIVE_META_STORE)
                db.createObjectStore(LIVE_HASH_STORE)

                didUpgrade = true
            },
        })

        const logDb = new LogDb(db)
        if (didUpgrade) {
            await logDb.clearLiveLog()
        }

        return logDb
    }

    async appendToLiveLog(lines: LogEntry[]): Promise<void> {
        for (const line of lines) {
            await this.db.add(LIVE_STORE, line)
        }
        // console.log("append", lines)

        this.put(
            LIVE_META_STORE,
            "lastUpdate",
            new Date().toISOString()
        )
    }

    async isNewLine(line: LogEntry): Promise<boolean> {
        let isNew = true

        const cursor = await this.db
            .transaction(LIVE_STORE)
            .store.openCursor(null, "prev")
        if (cursor) {
            isNew = !isEqual(cursor.value, line)
        }

        return isNew
    }

    async flushLiveLog(
        defaults?: Partial<{ hash: LogHash }>
    ): Promise<CompleteLog> {
        console.debug("Archiving log")

        // Build metadata
        const meta = {} as LogMeta
        const metaStore = this.db.transaction(LIVE_META_STORE).store
        for await (const cursor of metaStore) {
            // @ts-ignore
            meta[cursor.key] = cursor.value
        }

        const log: CompleteLog = { meta, entries: [] }

        // Get events
        const cursor = await this.db
            .transaction(LIVE_STORE)
            .store.openCursor(null, "next")
        if (!cursor) {
            console.debug("Skipping archival of empty log")
            return log
        }

        for await (const line of cursor) {
            log.entries.push(line.value)
        }

        // Insert
        await this.db.add(COMPLETE_STORE, log)
        console.debug(log)

        // Clear
        await this.clearLiveLog(defaults)

        // Done
        return log
    }

    async clearLiveLog(
        defaults?: Partial<{ hash: LogHash }>
    ): Promise<void> {
        console.debug("Clearing log")

        const txn = this.db.transaction(
            [LIVE_STORE, LIVE_META_STORE, LIVE_HASH_STORE],
            "readwrite"
        )

        // Live
        await txn.objectStore("live").clear()

        // Live meta
        await txn.objectStore(LIVE_META_STORE).clear()
        await this.put(
            txn.objectStore(LIVE_META_STORE),
            "start",
            new Date().toISOString()
        )
        await this.put(
            txn.objectStore(LIVE_META_STORE),
            "lastUpdate",
            new Date().toISOString()
        )

        // Live hash
        await txn.objectStore(LIVE_HASH_STORE).clear()
        await this.put(
            txn.objectStore(LIVE_HASH_STORE),
            "battleType",
            defaults?.hash?.battleType ?? ""
        )
        await this.put(
            txn.objectStore(LIVE_HASH_STORE),
            "maxRound",
            defaults?.hash?.maxRound ?? -1
        )
        await this.put(
            txn.objectStore(LIVE_HASH_STORE),
            "currentRound",
            defaults?.hash?.currentRound ?? -1
        )

        await txn.done
    }

    async getLogHash(): Promise<LogHash> {
        if (this.logHashCache) {
            return this.logHashCache
        }

        const store = this.db.transaction(LIVE_HASH_STORE).store

        this.logHashCache = {
            battleType: (await this.get(store, "battleType")) as any,
            currentRound: (await this.get(
                store,
                "currentRound"
            )) as any,
            maxRound: (await this.get(store, "maxRound")) as any,
        }

        return this.logHashCache
    }

    async putLogHash(hash: LogHash): Promise<void> {
        console.debug("Updating hash", hash)

        const store = this.db.transaction(
            LIVE_HASH_STORE,
            "readwrite"
        ).store

        await this.put(store, "battleType", hash.battleType)
        await this.put(store, "maxRound", hash.maxRound)
        await this.put(store, "currentRound", hash.currentRound)

        this.logHashCache = hash
    }

    async get<TStore extends idb.StoreNames<LogDbSchema>>(
        store: TStore | LogDbStore<TStore>,
        key: idb.StoreKey<LogDbSchema, TStore>
    ): Promise<idb.StoreValue<LogDbSchema, TStore>> {
        store =
            typeof store === "string"
                ? this.db.transaction(store).store
                : store
        return (await store.get(key))!
    }

    async put<TStore extends idb.StoreNames<LogDbSchema>>(
        store: TStore | LogDbStore<TStore, "readwrite">,
        key: idb.StoreKey<LogDbSchema, TStore>,
        value: idb.StoreValue<LogDbSchema, TStore>
    ): Promise<void> {
        store =
            typeof store === "string"
                ? this.db.transaction(store, "readwrite").store
                : store
        await store.put(value, key)
    }
}

interface LogDbSchema extends idb.DBSchema {
    complete: {
        key: number
        value: CompleteLog
    }
    live: {
        key: number
        value: LogEntry
    }
    live_meta: {
        key: keyof LogMeta
        value: ValueOf<LogMeta>
    }
    live_hash: {
        key: keyof LogHash
        value: ValueOf<LogHash>
    }
}

type ISODate = string

export interface LogMeta {
    start: ISODate
    lastUpdate: ISODate
}

export interface LogHash {
    battleType: string
    currentRound: number
    maxRound: number
}

export interface CompleteLog {
    meta: LogMeta
    entries: LogEntry[]
}

export type LogEntry =
    | { type: "event"; event: HvEvent }
    | { type: "error"; detail: string }

type LogDbStore<
    TStore extends idb.StoreNames<LogDbSchema>,
    TMode extends IDBTransactionMode = "readonly"
> = idb.IDBPObjectStore<LogDbSchema, any, TStore, TMode>
