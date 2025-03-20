import * as idb from "idb"
import { isEqual } from "radash"
import { HvEvent } from "./parserSchema"

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

    async appendToLiveLog(lines: HvEvent[]): Promise<void> {
        for (const line of lines) {
            await this.db.add(LIVE_STORE, line)
        }
    }

    async isNewLine(line: HvEvent): Promise<boolean> {
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
        for await (const cursor of this.db.transaction(
            LIVE_META_STORE
        ).store) {
            meta[cursor.key] = cursor.value
        }
        meta["end"] = meta["end"] ?? new Date().toISOString()

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

        const log: HvEvent[] = []
        for await (const line of cursor) {
            log.push(line.value)
        }

        // Done
        return { meta, log }

        function validateMeta(meta: any) {
            const keys = ["start", "end"] as Array<keyof LogMeta>
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
        await txn.done
    }

    async setLiveStart(): Promise<void> {
        const now = new Date().toISOString()
        await this.db
            .transaction("live_meta", "readwrite")
            .store.add(now, "start")
    }
}

interface LogDbSchema extends idb.DBSchema {
    complete: {
        key: number
        value: CompleteLog
    }
    live_meta: {
        key: keyof LogMeta
        value: string
    }
    live: {
        key: number
        value: HvEvent
    }
}

type ISODate = string

export interface LogMeta {
    start: ISODate
    end: ISODate
}

export interface CompleteLog {
    meta: LogMeta
    log: HvEvent[]
}
