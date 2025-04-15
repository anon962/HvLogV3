import * as idb from "idb"
import { isEqual } from "radash"
import { HvEvent } from "../parsers"
import {
    compressGzip,
    concatArrays,
    decompressGzip,
    enumerate,
    uuidWithFallback,
} from "../utils/miscUtils"
import { ValueOf } from "../utils/typeUtils"
import { readUrl } from "../utils/userscriptUtils"
import { migrateData, migrateSchema } from "./migrateDb"

const COMPLETE_STORE = "complete"
const LIVE_STORE = "live"
const LIVE_META_STORE = "live_meta"
const LIVE_HASH_STORE = "live_hash"

const STORAGE_KEY_PERSISTENT = "HvLog"
const STORAGE_KEY_ISEKAI = "HvLog_isekai"

const LOG_DB_VERSION = 2

export class LogDb {
    constructor(public db: idb.IDBPDatabase<LogDbSchema>) {}

    static async ainit(
        locationOverride?: "isekai" | "persistent"
    ): Promise<LogDb> {
        let key
        if (locationOverride) {
            key =
                locationOverride === "isekai"
                    ? STORAGE_KEY_ISEKAI
                    : STORAGE_KEY_PERSISTENT
        } else {
            key = readUrl().isIsekai
                ? STORAGE_KEY_ISEKAI
                : STORAGE_KEY_PERSISTENT
        }

        let isNewDb = false
        const db = await idb.openDB<LogDbSchema>(
            key,
            LOG_DB_VERSION,
            {
                upgrade: (db, oldVersion, newVersion, txn) => {
                    console.debug(
                        "Initializing log db",
                        oldVersion,
                        newVersion
                    )

                    isNewDb = oldVersion === 0
                    if (isNewDb) {
                        db.createObjectStore(COMPLETE_STORE, {
                            keyPath: "id",
                        })
                        db.createObjectStore(LIVE_STORE, {
                            autoIncrement: true,
                        })
                        db.createObjectStore(LIVE_META_STORE)
                        db.createObjectStore(LIVE_HASH_STORE)
                    } else {
                        migrateSchema(db, oldVersion)
                    }
                },
            }
        )

        const txn = db.transaction(db.objectStoreNames, "readwrite")
        try {
            await migrateData(db, txn)
        } catch (e) {
            console.error(e)
            txn.abort()
            alert("HvLog: database migration failed")
            throw e
        }

        const logDb = new LogDb(db)
        if (isNewDb) {
            // Initialize
            await logDb.clearLiveLog()
        }

        return logDb
    }

    async appendToLiveLog(entries: LogEntry[]): Promise<void> {
        const txn = this.db.transaction(
            [LIVE_STORE, LIVE_META_STORE],
            "readwrite"
        )

        for (const line of entries) {
            await txn.objectStore(LIVE_STORE).add(line)
        }
        // console.log("append", lines)

        await txn
            .objectStore(LIVE_META_STORE)
            .put(new Date().toISOString(), "lastUpdate")
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

        const log: CompleteLog = {
            id: uuidWithFallback(),
            meta,
            compressed: false,
            entries: [],
        }

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
        const store = this.db.transaction(LIVE_HASH_STORE).store

        return {
            battleType: (await this.get(store, "battleType")) as any,
            currentRound: (await this.get(
                store,
                "currentRound"
            )) as any,
            maxRound: (await this.get(store, "maxRound")) as any,
        }
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
    }

    async *iterLogs(): AsyncIterable<CompleteLog> {
        const iter = await this.db
            .transaction(COMPLETE_STORE)
            .store.openCursor()

        if (!iter) {
            return []
        }

        for await (const cursor of iter) {
            const log = cursor.value

            if (log.compressed) {
                yield await decompressLog(log)
            } else {
                yield log
            }
        }

        return iter
    }

    private async fetchAllLogs(): Promise<
        Array<CompleteLog | CompressedLog>
    > {
        const iter = await this.db
            .transaction(COMPLETE_STORE)
            .store.openCursor()

        if (!iter) {
            return []
        }

        const result = []
        for await (const cursor of iter) {
            const log = cursor.value
            result.push(log)
        }

        return result
    }

    async getLog(id: LogId): Promise<CompleteLog> {
        const log = (await this.db.get(COMPLETE_STORE, id))!
        return log?.compressed ? decompressLog(log) : log
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

    async count(key: idb.StoreNames<LogDbSchema>) {
        return await this.db.count(key)
    }

    async *replaceLogs(
        logs: CompleteLog[],
        compress = true
    ): AsyncIterable<number> {
        const txn = this.db.transaction(COMPLETE_STORE, "readwrite")

        await txn.store.clear()

        for (let idx = 0; idx < logs.length; idx++) {
            const log = logs[idx]
            await txn.store.add(
                compress ? await compressLog(log) : log
            )
            yield idx
        }
    }

    async getLogIds() {
        return await this.db.getAllKeys(COMPLETE_STORE)
    }

    async compressLogs() {
        const logs = await this.fetchAllLogs()

        for (const [idx, log] of enumerate(logs)) {
            if (log.compressed) continue

            console.debug("Compressing", log.id, log.meta)
            const compressed = await compressLog(log)

            const txn = this.db.transaction(
                COMPLETE_STORE,
                "readwrite"
            )
            await txn.store.put(compressed)
        }
    }
}

async function decompressLog(
    log: CompressedLog
): Promise<CompleteLog> {
    const entries = JSON.parse(await decompressGzip([log.entries]))
    return {
        ...log,
        compressed: false,
        entries,
    }
}

async function compressLog(log: CompleteLog): Promise<CompressedLog> {
    const asStr = JSON.stringify(log.entries)
    const asArrays = await compressGzip(asStr)
    const asSingleArray = concatArrays(asArrays)

    return {
        ...log,
        compressed: true,
        entries: asSingleArray,
    }
}

export interface LogDbSchema extends idb.DBSchema {
    complete: {
        key: LogId
        value: DbLog
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

export type LogId = string
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

interface CompressedLog {
    id: LogId
    meta: LogMeta
    compressed: true
    entries: Uint8Array
}

export interface CompleteLog {
    id: LogId
    meta: LogMeta
    compressed: false
    entries: LogEntry[]
}

export type LogEntry<TEvent extends HvEvent = HvEvent> =
    | { type: "event"; event: TEvent }
    | { type: "error"; detail: string }

type LogDbStore<
    TStore extends idb.StoreNames<LogDbSchema>,
    TMode extends IDBTransactionMode = "readonly"
> = idb.IDBPObjectStore<LogDbSchema, any, TStore, TMode>

type DbLog = CompleteLog | CompressedLog

export type LogDbBackup = [
    { type: "meta"; version: number },
    ...Array<{ type: "persistent" | "isekai"; log: CompleteLog }>
]
