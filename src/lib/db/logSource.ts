import { DbN, LogEntries } from "@/lib/db/dbN"
import {
    DetailsSummary,
    SearchSummary,
    summarizeSearchStats,
} from "@/lib/stats/summary"
import { decompressZstd } from "@/lib/utils/miscUtils"
import {
    alphabeticalBy,
    compressGzip,
    isTruthy,
    newContext,
    objectEntries,
    sleep,
    sort,
    Unsub,
    zip,
} from "myutils"
import { useEffect, useRef } from "react"
import { IS_REMOTE } from "../constants"
import { MetaSummary } from "../stats/metaStats"
import { parseLogWithDetails } from "../worker"
import { LogDb, LogDbConn } from "./db"
import { LogSourceN as N } from "./logSourceN"
// @ts-ignore
import parseLogWithDetailsSrc from "../worker?workerfn=parseLogWithDetails"
import { USERSCRIPT_CONFIG, UserscriptConfig } from "./userscriptConfig"

// #region remote
class LogSourceRemote implements N.Protocol {
    private HVDATA_URL = ""

    private prices: Promise<Record<string, number>> | null = null
    private globalMonsterSummary: Promise<any> | null = null
    private monlab: Promise<Record<number, N.MonlabMonster>> | null = null

    async fetchSearch(req: N.SearchRequest): Promise<N.SearchResponse> {
        const resp = await this.searchCache.fetch(req)
        const result = {
            ...resp,
            results: resp.results.map((x) => this.searchLogCache.get(x.id)!),
        }
        return result
    }
    async fetchLog(): Promise<any> {
        throw new Error("not implemented")
    }
    async fetchMeta(id: string) {
        const { meta } = await this.metaEntriesCache.fetch(id)
        return meta
    }
    async fetchEntries(id: string) {
        const { entries } = await this.metaEntriesCache.fetch(id)
        return entries
    }
    async fetchDetails(id: string) {
        return await this.detailsCache.fetch(id)
    }
    async fetchPrices() {
        if (!this.prices) {
            const url = this.HVDATA_URL + `/api/fapspreader.json`
            this.prices = fetch(url).then(async (resp) => resp.json())
        }

        return this.prices
    }
    async fetchGlobalMonsterSummary() {
        if (this.globalMonsterSummary === null) {
            const url = this.HVDATA_URL + `/api/battle_logs/monsters.json`
            async function doFetch() {
                while (true) {
                    const resp = await fetch(url)
                    const data = await resp.json()
                    if (data !== null) {
                        return data
                    } else {
                        await sleep(1000)
                    }
                }
            }

            this.globalMonsterSummary = doFetch()
        }

        return this.globalMonsterSummary
    }
    async fetchMonlab() {
        if (!this.monlab) {
            const url = this.HVDATA_URL + `/api/hv-monsterdb.json`
            this.monlab = fetch(url).then(async (resp) => {
                const data: Array<N.MonlabMonster> = await resp.json()
                const byMid = data.reduce(
                    (acc, x) => {
                        acc[x.monsterId] = x
                        return acc
                    },
                    {} as Record<number, N.MonlabMonster>,
                )
                return byMid
            })
        }

        return this.monlab
    }

    // #region remote caches
    private metaEntriesCache = new N.AsyncCache<
        DbN.LogId,
        { meta: DbN.LogMeta; entries: LogEntries }
    >({
        ttl: null,
        toRaw: (x) => x,
        fromRaw: (x) => x,
        fetch: async (id: DbN.LogId) => {
            const url = this.HVDATA_URL + `/api/battle_logs/${id}` + `?events=1`
            const resp = await fetch(url).then(async (resp) => resp.json())
            return {
                meta: {
                    startedAt: resp.created_at.replace("+00:00", "") + "Z",
                    endedAt: resp.created_at.replace("+00:00", "") + "Z",
                    world: "persistent",
                    user_id: resp.id_user,
                    user_name: resp.name,
                    errors: {
                        missingTurns: false,
                    },
                } as const,
                entries: resp.parsed.events.entries,
            }
        },
    })
    private detailsCache = new N.AsyncCache<string, DetailsSummary>({
        ttl: null,
        fromRaw: (x) => x,
        toRaw: (x) => x,
        fetch: async (id: DbN.LogId) => {
            const url =
                this.HVDATA_URL + `/api/battle_logs/${id}` + `?details=1`
            const resp = await fetch(url).then(async (resp) => resp.json())
            return resp.parsed.details
        },
    })
    private searchLogCache = new Map<string, N.SearchResult>()
    private searchCache = new N.AsyncCache<
        N.SearchRequest,
        Omit<N.SearchResponse, "results"> & {
            results: Array<{ id: DbN.LogId }>
        }
    >({
        ttl: 5 * 60 * 1000,
        toRaw: (req) => JSON.stringify(req),
        fromRaw: (raw) => JSON.parse(raw),
        fetch: async (req) => {
            const resp = await fetch(this.HVDATA_URL + "/api/search_logs", {
                method: "POST",
                body: await compressGzip(
                    JSON.stringify({
                        ...req,
                        seen: [...this.searchLogCache.keys()],
                    }),
                ),
                headers: {
                    "Content-Type": "application/json",
                    "Content-Encoding": "gzip",
                },
            })

            const data: N.SearchResponse = await resp.json()

            for (const log of data.results) {
                if (this.searchLogCache.has(log.id)) {
                    continue
                }

                this.searchLogCache.set(log.id, log)
            }

            return {
                ...data,
                results: data.results.map((x) => ({ id: x.id })),
            }
        },
    })
    // #endregion
}
// #endregion

// #region local
type LocalKey = { world: DbN.HvWorld; id: DbN.LogId }
const newLocalCache = <T>(
    self: LogSourceLocal,
    opts: {
        fetch: (
            db: LogDb<true>,
            conn: LogDbConn,
            id: DbN.LogId,
            k: LocalKey,
        ) => Promise<T>
        size?: number
        ttl?: number | null
    },
) =>
    new N.AsyncCache<LocalKey, T>({
        ttl: opts.ttl ?? null,
        size: opts.size,
        fromRaw: (raw) => JSON.parse(raw),
        toRaw: (k) => JSON.stringify(k),
        fetch: async (k) => {
            const db = await self.db[k.world]
            const conn = await db.conn
            return opts.fetch(db, conn, k.id, k)
        },
    })
class LogSourceLocal implements N.Protocol {
    db: Record<DbN.HvWorld, Promise<LogDb<true>>>
    pool: ReturnType<LogSourceLocal["initWorkerPool"]>
    prices: Promise<UserscriptConfig["prices"]>
    world: DbN.HvWorld
    private bcSub: Unsub
    private logIds = {
        persistent: new Set<DbN.LogId>(),
        isekai: new Set<DbN.LogId>(),
    }
    ainit: Promise<void>

    constructor(prices: Promise<UserscriptConfig["prices"]>) {
        this.db = {
            persistent: new LogDb({ world: "persistent" }).connect(),
            isekai: new LogDb({ world: "isekai" }).connect(),
        }
        this.pool = this.initWorkerPool()
        this.world = "persistent"

        this.prices = prices

        const self: LogSourceLocal = this
        this.bcSub = DbN.listenIdbEvent((ev, details) => {
            switch (ev.type) {
                case DbN.IDB_LOG_INSERT_EVENT:
                    for (const id of ev.ids) {
                        self.logIds[ev.world].add(id)
                    }
                    break
                case "hvlog_config_change":
                    this.prices = prices
                    break
            }
        })

        this.ainit = (async () => {
            for (const world of ["persistent", "isekai"] as const) {
                const ids = this.logIds[world]
                const conn = await this.dbConn
                for (const id of await conn.getAllKeys("logsMeta")) {
                    ids.add(id)
                }
            }
        })()
    }

    async fetchMeta(id: string) {
        return await this.metaCache.fetch({ id, world: this.world })
    }
    async fetchLog(id: string) {
        return await this.rawCache.fetch({ id, world: this.world })
    }
    async fetchDetails(id: string) {
        return (await this.entriesDetailsCache.fetch({ id, world: this.world }))
            .details
    }
    async fetchSearch(req: N.SearchRequest): Promise<N.SearchResponse> {
        return await this.searchResponseCache.fetch(req)
    }
    async fetchEntries(id: string) {
        return (await this.entriesDetailsCache.fetch({ id, world: this.world }))
            .entries
    }
    async fetchPrices() {
        return (await this.prices)[this.world]
    }
    async fetchMonlab(): Promise<any> {
        throw new Error("not implemented")
    }
    async fetchGlobalMonsterSummary(): Promise<any> {
        throw new Error("not implemented")
    }

    private static FILTER_CONDITIONS = {
        battleType: (d, s, m, ms) =>
            d.some((bt) => s.meta.battleType?.id === bt),
        primaryStyle: (d, s, m, ms) =>
            d.some((style) => style === s.style.primary?.id),
        secondaryStyle: (d, s, m, ms) =>
            d.some((style) => style === s.style.primary?.id),
        isImperil: (d, s, m, ms) => s.style.isImperil === d,
        startDate: (d, s, m, ms) => d <= m.startedAt,
        endDate: (d, s, m, ms) => d >= m.startedAt,
        errors: (d, s, m, ms) =>
            Object.entries(d).some(
                ([k, v]) => v !== null && (ms as any).errors[k] === v,
            ) ||
            (!!d.none && Object.values(ms).every((v) => v === false)),
        completionType: (d, s, m, ms) => d.some((d) => d === ms.completionType),
        roundMin: (d, s, m, ms) =>
            typeof ms.round?.end === "number" && ms.round.end >= d,
        roundMax: (d, s, m, ms) =>
            typeof ms.round?.end === "number" && ms.round.end <= d,
    } as const satisfies Partial<{
        [K in keyof N.SearchRequest]: (
            x: Exclude<N.SearchRequest[K], null | undefined>,
            search: SearchSummary,
            meta: DbN.LogMeta,
            metaSummary: MetaSummary,
        ) => boolean
    }>

    // #region local caches
    private metaCache = newLocalCache<DbN.LogMeta>(this, {
        fetch: async (db, conn, id, k) => {
            const r = (await conn.get("logsMeta", id))!
            return {
                startedAt: r.startedAt,
                endedAt: r.endedAt,
                world: r.world,
                user_id: null,
                user_name: null,
                errors: {
                    missingTurns: false,
                },
            }
        },
    })
    private rawCache = newLocalCache<string>(this, {
        size: 10,
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
    private entriesDetailsCache = newLocalCache(this, {
        size: 10,
        fetch: async (db, conn, id, k) => {
            const raw = await this.rawCache.fetch(k)
            return await this.pool.parseLogWithDetails({
                log: raw,
                createdAt: null,
            })
            // const st = performance.now()
            // const result = await parseLogWithDetails({
            //     log: raw,
            //     createdAt: null,
            // })
            // const elapsed = performance.now() - st
            // console.debug(
            //     `Parsed ${result.entries.length} entries in ${elapsed}ms (${((1000 * elapsed) / result.entries.length).toFixed(1)}us per)`,
            // )
            // return result
        },
    })
    private metaSearchCache = newLocalCache<{
        search: SearchSummary
        meta: MetaSummary
    }>(this, {
        fetch: async (db, conn, id, k) => {
            let meta: MetaSummary
            const metaFromDb = await conn.get("summariesForMeta", k.id)
            if (!metaFromDb || metaFromDb.version !== LogDb.parserVersion) {
                const details = (await this.entriesDetailsCache.fetch(k))
                    .details
                await conn.put("summariesForMeta", {
                    id: k.id,
                    version: LogDb.parserVersion,
                    data: details.meta,
                })
                meta = details.meta
            } else {
                meta = metaFromDb.data
            }

            let search: SearchSummary
            const searchFromDb = await conn.get("summariesForSearch", k.id)
            if (!searchFromDb || searchFromDb.version !== LogDb.parserVersion) {
                const details = (await this.entriesDetailsCache.fetch(k))
                    .details
                search = summarizeSearchStats(details, await this.fetchPrices())
                await conn.put("summariesForSearch", {
                    id: k.id,
                    version: LogDb.parserVersion,
                    data: search,
                })
            } else {
                search = searchFromDb.data
            }

            return { meta, search }
        },
    })
    // #region: local search
    private searchResponseCache = new N.AsyncCache<
        N.SearchRequest,
        N.SearchResponse
    >({
        toRaw: (req) => JSON.stringify(req),
        fromRaw: (raw) => JSON.parse(raw),
        ttl: (resp) => resp.ttl ?? null,
        size: 50,
        fetch: async (req) => {
            await this.ainit

            const allIds = this.logIds[this.world]
            const ids: Array<DbN.LogId> = []

            let toFetch = Promise.resolve<any>(null)
            const pushToFetch = (k: LocalKey) => {
                toFetch = toFetch.then(async () => {
                    await this.metaSearchCache.fetch(k)
                    await sleep(1)
                })
            }

            const xs: Array<{ meta: MetaSummary; search: SearchSummary }> = []
            for (const id of allIds) {
                const k = {
                    world: this.world,
                    id,
                }
                const fromCache = this.metaSearchCache.cache.get(k)?.data
                if (fromCache) {
                    xs.push(fromCache)
                    ids.push(id)
                } else {
                    pushToFetch(k)
                }
            }
            const hasPending = xs.length !== allIds.size

            const metas = await Promise.all(
                ids.map((id) =>
                    this.metaCache.fetch({ world: this.world, id }),
                ),
            )

            const matches = zip(metas, xs, ids).filter(([m, x]) => {
                return objectEntries(LogSourceLocal.FILTER_CONDITIONS).every(
                    ([k, cond]) =>
                        !isTruthy(req[k]) ||
                        (cond as any)(req[k], x.search, m, x.meta),
                )
            })

            let sorted
            const sortType = req.sort?.type ?? "date"
            const isDesc = req.sort?.order !== "asc"
            switch (sortType) {
                case "date":
                    sorted = alphabeticalBy(
                        matches,
                        ([m, x]) => m.startedAt,
                        isDesc,
                    )
                    break
                case "profit":
                    sorted = sort(
                        matches,
                        ([m, x]) => x.search.finances.profit,
                        isDesc,
                    )
                    break
                case "turns":
                    sorted = sort(
                        matches,
                        ([m, x]) => x.search.meta.turnCount,
                        isDesc,
                    )
                    break
                default:
                    sorted = matches
                    break
            }

            const st = req.pageIdx * req.pageSize
            const page = sorted.slice(st, st + req.pageSize)

            const results = page.map(([m, x, id]) => ({
                id,
                meta: m,
                search: x.search,
            }))

            return {
                currPage: req.pageIdx,
                lastPage: Math.ceil(matches.length / req.pageSize),
                resultCount: matches.length,
                pageSize: req.pageSize,
                results,
                ttl: hasPending ? 0.25 : 10,
                stale: hasPending,
            }
        },
    })
    // #endregion

    get dbConn() {
        return this.db[this.world].then((db) => db.conn)
    }

    private initWorkerPool() {
        return window.HV_LOG.workerPool.registerModule(
            "LogSourceLocal",
            () => ({
                reps: {
                    parseLogWithDetailsSrc: JSON.stringify(
                        parseLogWithDetailsSrc,
                    ),
                },
                initCtx: async () => {
                    ;(globalThis as any).parseLogWithDetails = globalThis.eval(
                        parseLogWithDetailsSrc,
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
}
// #endregion

export const LOG_SOURCE = newContext<N.Protocol>(() => {
    const { config, ready: configReady } = USERSCRIPT_CONFIG.useContext()
    const { promise: prices, resolve: resolvePrices } = useRef(
        Promise.withResolvers<UserscriptConfig["prices"]>(),
    ).current
    useEffect(() => {
        if (configReady) {
            resolvePrices(config.prices)
        }
    }, [config, configReady])

    return {
        value: IS_REMOTE ? new LogSourceRemote() : new LogSourceLocal(prices),
        setValue: () => {},
    }
})
