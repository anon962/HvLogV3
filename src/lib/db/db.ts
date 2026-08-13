import * as idb from "idb"
import { DbN } from "./dbN"
import { readUrl } from "../utils/userscriptUtils"
import { L } from "myutils"

const STORAGE_KEY_PERSISTENT = "HvLog"
const STORAGE_KEY_ISEKAI = "HvLog_isekai"

type IdbSchema = {
    [K in keyof DbN.IdbSchema]: DbN.IdbSchema[K] extends Record<
        infer K2,
        infer V2
    >
        ? { key: K2; value: V2 }
        : never
}
export type LogDbConn = idb.IDBPDatabase<IdbSchema>
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

        this.conn = idb.openDB<IdbSchema>(dbName, LogDb.schemaVersion, {
            upgrade: (conn, oldVersion, newVersion, txn, event) => {
                L.info("Upgrading HvLog db ...")
                this.applySchemaMigrations(conn, oldVersion)
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

                conn.deleteObjectStore("live")
                conn.createObjectStore("live")

                v += 1
                continue
            } else {
                throw new Error(`Invalid version ${v}`)
            }
        }
    }
}
