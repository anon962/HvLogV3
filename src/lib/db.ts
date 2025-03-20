import * as idb from "idb"
import { isEqual } from "radash"
import { HvEvent } from "./parserSchema"
import { ValueOf } from "./utils/typeUtils"

const COMPLETE_STORE = "complete"
const LIVE_STORE = "live"
const LIVE_META_STORE = "live_meta"

export class LogDb {
    constructor(public db: idb.IDBPDatabase<LogDbSchema>) {}

    static async init(): Promise<LogDb> {
        const db = await idb.openDB<LogDbSchema>("HvLog", 1, {
            upgrade: async (db) => {
                createIfNotExists(db, COMPLETE_STORE, {
                    autoIncrement: true,
                })
                createIfNotExists(db, LIVE_STORE, {
                    autoIncrement: true,
                })
                createIfNotExists(db, LIVE_META_STORE, {
                    autoIncrement: true,
                })
            },
        })

        return new LogDb(db)

        function createIfNotExists(
            x: typeof db,
            name: idb.StoreNames<LogDbSchema>,
            opts?: IDBObjectStoreParameters
        ) {
            try {
                return x.createObjectStore(name, opts)
            } catch (e) {
                console.log(`Skipping ${name} store creation`, e)
                return null
            }
        }
    }

    async appendToLiveLog(lines: LogEvent[]): Promise<void> {
        for (const line of lines) {
            await this.db.add(LIVE_STORE, line)
        }

        this.set(
            LIVE_META_STORE,
            "last_update",
            new Date().toISOString()
        )
    }

    async isNewLine(line: LogEvent): Promise<boolean> {
        let isNew = true

        const cursor = await this.db
            .transaction(LIVE_STORE)
            .store.openCursor(null, "prev")
        if (cursor) {
            isNew = isEqual(cursor.value, line)
        }

        return isNew
    }

    async compileLiveLog(): Promise<CompleteLog> {
        // Build metadata
        const meta = {} as LogMeta
        const metaStore = this.db.transaction(LIVE_META_STORE).store
        for await (const cursor of metaStore) {
            meta[cursor.key] = cursor.value
        }

        // Validate
        if (!validateMeta(meta)) {
            throw new Error(
                `Missing log metadata ${JSON.stringify(meta)}`
            )
        }

        // Build log
        const cursor = await this.db
            .transaction(LIVE_STORE)
            .store.openCursor(null, "next")
        if (!cursor) {
            throw new Error("Tried to archive empty log")
        }

        const log: LogEvent[] = []
        for await (const line of cursor) {
            log.push(line.value)
        }

        // Done
        return { meta, log }

        function validateMeta(meta: any) {
            const keys = ["start", "last_update"] satisfies Array<
                keyof LogMeta
            >
            for (const key of keys) {
                if (!(key in meta)) {
                    return false
                }
            }

            return true
        }
    }

    async clearLiveLog(): Promise<void> {
        const txn = this.db.transaction(
            [LIVE_META_STORE, LIVE_STORE],
            "readwrite"
        )
        await txn.objectStore("live").clear()

        await txn.objectStore(LIVE_META_STORE).clear()
        await this.set(
            txn.objectStore(LIVE_META_STORE),
            "last_update",
            new Date().toISOString()
        )

        await txn.done
    }

    async get<TStore extends idb.StoreNames<LogDbSchema>>(
        store: TStore,
        key: idb.StoreKey<LogDbSchema, TStore>
    ): Promise<idb.StoreValue<LogDbSchema, TStore>> {
        return (await this.db.transaction(store).store.get(key))!
    }

    async set<TStore extends idb.StoreNames<LogDbSchema>>(
        store: TStore | LogDbStore<TStore, "readwrite">,
        key: idb.StoreKey<LogDbSchema, TStore>,
        value: idb.StoreValue<LogDbSchema, TStore>
    ): Promise<void> {
        store =
            typeof store === "string"
                ? this.db.transaction(store, "readwrite").store
                : store
        await store.add(value, key)
    }
}

interface LogDbSchema extends idb.DBSchema {
    complete: {
        key: number
        value: CompleteLog
    }
    live_meta: {
        key: keyof LogMeta
        value: ValueOf<LogMeta>
    }
    live: {
        key: number
        value: LogEvent
    }
}

type ISODate = string

export interface LogMeta {
    start: ISODate
    last_update: ISODate
}

export interface CompleteLog {
    meta: Pick<LogMeta, "start" | "last_update">
    log: LogEvent[]
}

export type LogEvent =
    | { type: "event"; event: HvEvent }
    | { type: "error"; detail: string }

type LogDbStore<
    TStore extends idb.StoreNames<LogDbSchema>,
    TMode extends IDBTransactionMode = "readonly"
> = idb.IDBPObjectStore<LogDbSchema, any, TStore, TMode>
