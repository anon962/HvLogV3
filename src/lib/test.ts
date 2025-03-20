import { DBSchema, IDBPDatabase } from "idb"

export class LogDb {
    constructor(public db: Db) {}

    async flushLiveLog(): Promise<void> {
        const meta: any = {}

        const store = this.db.transaction("live").store
        for await (const cursor of store) {
            meta[cursor.key] = cursor.value
        }
    }
}

export type Db = IDBPDatabase<MyDB>

interface MyDB extends DBSchema {
    complete: {
        key: number
        value: {
            meta: any
            log: any[]
        }
    }
    live_meta: {
        key: number
        value: any
    }
    live: {
        key: number
        value: any
    }
}
