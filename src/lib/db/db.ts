import * as idb from "idb"
import { DbN } from "./dbN"
import { readUrl } from "../utils/userscriptUtils"

const STORAGE_KEY_PERSISTENT = "HvLog"
const STORAGE_KEY_ISEKAI = "HvLog_isekai"

export type LogDbConn = idb.IDBPDatabase<DbN.Schema>
export class LogDb {
    world: DbN.HvWorld
    conn: LogDbConn | null = null
    version = 5

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

    async connect() {
        if (this.conn) {
            return this.conn
        }

        const dbName =
            this.world === "isekai"
                ? STORAGE_KEY_ISEKAI
                : STORAGE_KEY_PERSISTENT
        const conn = await idb.openDB<DbN.Schema>(dbName, this.version, {
            upgrade: (conn, oldVersion, newVersion, txn, event) => {
                this.applySchemaMigrations(conn, oldVersion)
            },
        })

        this.conn = conn
        return conn
    }

    // #region: migrations
    private applySchemaMigrations(conn: LogDbConn, initVersion: number) {
        let v = initVersion
        while (v <= this.version) {
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
                conn.createObjectStore("logs", { keyPath: "id" })

                v += 1
                continue
            }
        }
    }
}
