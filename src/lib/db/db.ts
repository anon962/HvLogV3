import * as idb from "idb"
import { L, readUrl } from "myutils"
import { DbN } from "./dbN"

const STORAGE_KEY_PERSISTENT = "HvLog"
const STORAGE_KEY_ISEKAI = "HvLog_isekai"

type IdbSchemaRaw = {
    [K in keyof DbN.IdbSchema]: DbN.IdbSchema[K] extends Record<
        infer K2,
        infer V2
    >
        ? { key: K2; value: V2 }
        : never
}
export type LogDbConn = idb.IDBPDatabase<IdbSchemaRaw>
export class LogDb<Ready extends boolean = false> {
    world: DbN.HvWorld
    conn: Ready extends true ? Promise<LogDbConn> : Promise<LogDbConn> | null =
        null as any
    static schemaVersion = 5
    static parserVersion = 2

    constructor(
        public opts: {
            world?: DbN.HvWorld
        },
    ) {
        if (opts.world) {
            this.world = opts.world
        } else {
            const { parts } = readUrl()
            this.world = parts[0] === "isekai" ? "isekai" : "persistent"
        }
    }

    async connect(): Promise<LogDb<true>> {
        if (this.conn) {
            await this.conn
            return this as any
        }

        const dbName =
            this.world === "isekai"
                ? STORAGE_KEY_ISEKAI
                : STORAGE_KEY_PERSISTENT

        this.conn = idb.openDB<IdbSchemaRaw>(dbName, LogDb.schemaVersion, {
            upgrade: (conn, oldVersion, newVersion, txn, event) => {
                L.info("Upgrading HvLog db ...")
                this.applySchemaMigrations(conn, oldVersion)
                this.purgeLegacyStorage()
                L.info(`Upgraded from ${oldVersion} to ${newVersion}`)
            },
            blocked(currentVersion, blockedVersion, event) {
                L.error("blocked", { currentVersion, blockedVersion })
            },
            blocking(currentVersion, blockedVersion, event) {
                L.error("blocking", { currentVersion, blockedVersion })
            },
        })

        await this.conn
        return this as any
    }

    // #region: migrations
    private applySchemaMigrations(conn: LogDbConn, initVersion: number) {
        let v = initVersion
        while (v <= LogDb.schemaVersion) {
            if (v === 0) {
                conn.createObjectStore("live")
                conn.createObjectStore("kv")

                v = 5
                continue
            } else if (v < 5) {
                // First release
                v = 5
                continue
            } else if (v === 5) {
                conn.createObjectStore("logsMeta", { keyPath: "id" })
                conn.createObjectStore("logsRaw", { keyPath: "id" })
                conn.createObjectStore("summariesForMeta", { keyPath: "id" })
                conn.createObjectStore("summariesForSearch", { keyPath: "id" })

                this.deleteObjectStore(conn, "live")
                this.deleteObjectStore(conn, "live_meta")
                this.deleteObjectStore(conn, "live_hash")

                this.createObjectStore(conn, "live")
                this.createObjectStore(conn, "kv")

                v += 1
                continue
            } else {
                throw new Error(`Invalid version ${v}`)
            }
        }
    }

    private createObjectStore(
        conn: LogDbConn,
        storeId: keyof DbN.IdbSchema,
        optionalParameters?: IDBObjectStoreParameters,
    ) {
        if (!conn.objectStoreNames.contains(storeId)) {
            conn.createObjectStore(storeId, optionalParameters)
        }
    }
    private deleteObjectStore(conn: LogDbConn, storeId: keyof DbN.IdbSchema) {
        if (conn.objectStoreNames.contains(storeId)) {
            conn.deleteObjectStore(storeId)
        }
    }

    private purgeLegacyStorage() {
        for (const key of [
            "hvlog_charts",
            "hvlog_equip_log_filter",
            "hvlog_log_list_page_size",
            "hvlog_selected_log",
            "hvlog_stats",
            "hvlog_stats_finances",
            "hvlog_stats_kills",
            "hvlog_summary_view",
            "react-resizable-panels:hvlog_detail_split",
            "hvlog_stats_drops",
            "hvlog_config",
        ]) {
            localStorage.removeItem(key)
        }
    }

    async get<
        Store extends keyof DbN.IdbSchema,
        Key extends keyof DbN.IdbSchema[Store],
    >(
        storeName: Store,
        key: Key,
    ): Promise<DbN.IdbSchema[Store][Key] | undefined> {
        const db = await this.connect()
        const conn = await db.conn
        // @ts-ignore
        return await conn.get(storeName, key)
    }
    async put<
        Store extends keyof DbN.IdbSchema,
        Key extends keyof DbN.IdbSchema[Store],
    >(storeName: Store, value: DbN.IdbSchema[Store][Key], key?: Key) {
        const db = await this.connect()
        const conn = await db.conn
        return await conn.put(storeName, value, key)
    }
    async add<
        Store extends keyof DbN.IdbSchema,
        Key extends keyof DbN.IdbSchema[Store],
    >(storeName: Store, value: DbN.IdbSchema[Store][Key], key?: Key) {
        const db = await this.connect()
        const conn = await db.conn
        return await conn.add(storeName, value, key)
    }
    async transaction<
        Stores extends Array<keyof DbN.IdbSchema>,
        Mode extends "readonly" | "readwrite",
    >(storeNames: Stores, mode?: Mode) {
        const db = await this.connect()
        const conn = await db.conn
        return conn.transaction(storeNames, mode)
    }
}
