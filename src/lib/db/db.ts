import * as idb from "idb"
import { isChrome, L, Unsub } from "myutils"
import { DbN } from "./dbN"
import { LogSourceN } from "./logSourceN"
import { MetaSummary } from "../stats/metaStats"
import { SearchSummary, summarizeSearchStats } from "../stats/summary"
import { compressZstd, decompressZstd } from "../utils/miscUtils"
import { parseLogWithDetails } from "../worker"
// @ts-ignore
import parseLogWithDetailsSrc from "../worker?workerfn=parseLogWithDetails"

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
    conn: Ready extends true ? Promise<LogDbConn> : Promise<LogDbConn> | null =
        null as any
    static schemaVersion = 5
    static parserVersion = 3

    constructor() {}

    async connect(): Promise<LogDb<true>> {
        if (this.conn) {
            await this.conn
            return this as any
        }

        this.conn = idb.openDB<IdbSchemaRaw>("HvLog", LogDb.schemaVersion, {
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

    // #region migrations
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
                conn.createObjectStore("logsHvdata", { keyPath: "id" })
                conn.createObjectStore("entriesCache", { keyPath: "id" })
                conn.createObjectStore("summariesForDetails", { keyPath: "id" })
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
    // #endregion

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
        // @ts-expect-error
        return await conn.get(storeName, key)
    }
    async getKey<
        Store extends keyof DbN.IdbSchema,
        Key extends keyof DbN.IdbSchema[Store],
    >(
        storeName: Store,
        key: Key,
    ): Promise<IdbSchemaRaw[Store]["key"] | undefined> {
        const db = await this.connect()
        const conn = await db.conn
        return await conn.getKey(storeName, key)
    }
    async getAllKeys<Store extends keyof DbN.IdbSchema>(
        storeName: Store,
    ): Promise<Array<IdbSchemaRaw[Store]["key"]>> {
        const db = await this.connect()
        const conn = await db.conn
        return await conn.getAllKeys(storeName)
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

// #region cache
export class LogDbCache {
    pool = this.initWorkerPool()
    // logIds = new Set<DbN.LogId>()
    detailsCacheHistory: Promise<DbN.IdbSchema["kv"]["detailsCacheHistory"]>
    deetsHistoryChangeCount = 0

    db: Promise<LogDb<true>>
    bcSub: Unsub

    constructor() {
        this.db = new LogDb().connect()
        this.detailsCacheHistory = this.fetchDetailsCacheHistory()

        this.bcSub = DbN.listenIdbEvent((ev, details) => {
            switch (ev.type) {
                // case DbN.IDB_LOG_INSERT_EVENT:
                //     for (const id of ev.ids) {
                //         self.logIds.add(id)
                //     }
                //     break
                case "hvlog_config_change":
                    this.metaSearchCache.clear()
                    break
            }
        })
    }

    rawCache = this.newLocalCache<string>({
        size: 3,
        fetch: async (db, conn, id) => {
            const r = (await conn.get("logsRaw", id))!
            if (r.raw !== null) {
                return r.raw
            } else {
                const decompressed = await decompressZstd({ x: r.raw_c })
                return await new Blob([decompressed]).text()
            }
        },
    })
    entriesDetailsCache = this.newLocalCache({
        size: isChrome() ? 10 : 3,
        fetch: async (db, conn, id) => {
            let entriesFromDb = await db.get("entriesCache", id)
            let detailsFromDb = await db.get("summariesForDetails", id)

            let entries, details
            if (
                entriesFromDb?.version !== LogDb.parserVersion ||
                detailsFromDb?.version !== LogDb.parserVersion
            ) {
                const raw = await this.rawCache.fetch(id)
                ;({ entries, details } = await this.pool.parseLogWithDetails({
                    log: raw,
                    createdAt: null,
                }))

                await db.put("entriesCache", {
                    id,
                    version: LogDb.parserVersion,
                    data: await compressZstd({
                        x: JSON.stringify(entries),
                        level: 10,
                        pool: true,
                    }),
                })
                await db.put("summariesForDetails", {
                    id,
                    version: LogDb.parserVersion,
                    data: await compressZstd({
                        x: JSON.stringify(details),
                        level: 10,
                        pool: true,
                    }),
                })
            } else {
                entries = JSON.parse(
                    await new Blob([
                        await decompressZstd({ x: entriesFromDb.data }),
                    ]).text(),
                )
                details = JSON.parse(
                    await new Blob([
                        await decompressZstd({ x: detailsFromDb.data }),
                    ]).text(),
                )
            }

            return { entries, details }
        },
        cbPost: async (id: DbN.LogId) => {
            const history = await this.detailsCacheHistory
            history[id] = {
                lastFetch: new Date().toISOString(),
            }
            this.deetsHistoryChangeCount += 1

            await this.flushDetailsCacheHistory()
        },
    })
    metaCache = this.newLocalCache<DbN.LogMeta>({
        fetch: async (db, conn, id) => {
            const r = (await conn.get("logsMeta", id))!
            return {
                startedAt: r.startedAt,
                endedAt: r.endedAt,
                world: r.world,
                user_id: null,
                user_name: null,
                importedAt: null,
                errors: {
                    missingTurns: false,
                },
            }
        },
    })
    metaSearchCache = new LogSourceN.AsyncCache<
        { id: DbN.LogId; prices: Record<DbN.HvWorld, DbN.Prices> },
        { meta: MetaSummary; search: SearchSummary }
    >({
        toRaw: (k) => JSON.stringify(k),
        fromRaw: (k) => JSON.parse(k),
        ttl: null,
        fetch: async (req) => {
            const db = await this.db

            const logMeta: DbN.LogMeta = await this.metaCache.fetch(req.id)

            let meta: MetaSummary
            const metaFromDb = await db.get("summariesForMeta", req.id)
            if (!metaFromDb || metaFromDb.version !== LogDb.parserVersion) {
                const details = (await this.entriesDetailsCache.fetch(req.id))
                    .details
                await db.put("summariesForMeta", {
                    id: req.id,
                    version: LogDb.parserVersion,
                    data: details.meta,
                })
                meta = details.meta
            } else {
                meta = metaFromDb.data
            }

            let search: SearchSummary
            const searchFromDb = await db.get("summariesForSearch", req.id)
            if (!searchFromDb || searchFromDb.version !== LogDb.parserVersion) {
                const details = (await this.entriesDetailsCache.fetch(req.id))
                    .details
                search = summarizeSearchStats(
                    details,
                    req.prices[logMeta.world],
                )
                await db.put("summariesForSearch", {
                    id: req.id,
                    version: LogDb.parserVersion,
                    data: search,
                })
            } else {
                search = searchFromDb.data
            }

            return { meta, search }
        },
    })
    uploadCache = this.newLocalCache({
        fetch: async (db, conn, id) => {
            const r = await db.get("logsHvdata", id)
            return r ?? null
        },
        ttl: (r) => (r === null ? 0 : null),
    })

    private newLocalCache<T>(
        opts: {
            fetch: (
                db: LogDb<true>,
                conn: LogDbConn,
                id: DbN.LogId,
            ) => Promise<T>
        } & Partial<
            Pick<
                LogSourceN.AsyncCache<DbN.LogId, T>["opts"],
                "size" | "ttl" | "cbPost"
            >
        >,
    ) {
        return new LogSourceN.AsyncCache<DbN.LogId, T>({
            ttl: opts.ttl ?? null,
            size: opts.size,
            fromRaw: (raw) => raw,
            toRaw: (k) => k,
            fetch: async (k) => {
                const db = await this.db
                const conn = await db.conn
                return opts.fetch(db, conn, k)
            },
        })
    }

    private initWorkerPool() {
        return window.HV_LOG.workerPool.registerModule(
            "LogSourceLocal",
            () => ({
                reps: {
                    '"parseLogWithDetailsSrc"': JSON.stringify(
                        parseLogWithDetailsSrc,
                    ),
                },
                initCtx: async () => {
                    ;(globalThis as any).parseLogWithDetails = globalThis.eval(
                        "parseLogWithDetailsSrc",
                    )
                },
                fns: {
                    parseLogWithDetails: async (opts: {
                        log: string
                        createdAt: Date | null
                    }) => {
                        // const st = performance.now()
                        const result = await parseLogWithDetails(opts)
                        // const elapsed = performance.now() - st
                        // console.debug(
                        //     `Parsed ${result.entries.length} entries in ${elapsed}ms (${((1000 * elapsed) / result.entries.length).toFixed(1)}us per)`,
                        // )
                        return result
                    },
                },
            }),
        )
    }

    private async fetchDetailsCacheHistory() {
        const db = await this.db
        return (await db.get("kv", "detailsCacheHistory")) ?? {}
    }
    async flushDetailsCacheHistory() {
        if (this.deetsHistoryChangeCount < 50) {
            return
        }
        this.deetsHistoryChangeCount = 0

        const db = await this.db
        return await db.put(
            "kv",
            await this.detailsCacheHistory,
            "detailsCacheHistory",
        )
    }
}
// #endregion

let mgr: LogDbCache | null = null
export const LOG_DB_CACHE = () => {
    if (!mgr) {
        mgr = new LogDbCache()
    }
    return mgr
}

export async function deleteLogs(db: LogDb, ids: Iterable<DbN.LogId>) {
    const equipDeletions = (await db.get("kv", "equipDeletions")) ?? new Set()

    const stores = [
        "logsMeta",
        "logsRaw",
        "logsHvdata",
        "summariesForMeta",
        "summariesForSearch",
    ] as const
    const txn = await db.transaction([...stores], "readwrite")
    for (const sid of stores) {
        for (const id of ids) {
            equipDeletions.add(id)

            const s = txn.objectStore(sid)
            if (await s.getKey(id)) {
                await s.delete(id)
            }
        }
    }
    txn.commit()

    DbN.broadcastIdbEvent({
        type: "hvlog_delete",
        ids: [...ids],
    })

    await db.put("kv", equipDeletions, "equipDeletions")
}
