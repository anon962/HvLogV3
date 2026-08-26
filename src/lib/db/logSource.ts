import { DbN, LogEntries } from "@/lib/db/dbN"
import { DetailsSummary, SearchSummary } from "@/lib/stats/summary"
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
import { IS_REMOTE, LOG_PROCESSING_LOCK } from "../constants"
import { IndexMap } from "../stats/indexMap"
import { MetaSummary } from "../stats/metaStats"
import { LOG_DB_CACHE, LogDb, LogDbCache, LogDbConn } from "./db"
import { LogSourceN as N } from "./logSourceN"
import { USERSCRIPT_CONFIG, UserscriptConfig } from "./userscriptConfig"

// #region remote
class LogSourceRemote implements N.Protocol {
    private HVDATA_URL = ""

    private prices: Promise<Record<string, number>> | null = null
    private globalMonsterSummary: Promise<any> | null = null
    private monlab: Promise<Record<number, N.MonlabMonster>> | null = null

    ainit = Promise.resolve()

    async fetchLogIds(): Promise<string[]> {
        throw new Error("not implemented")
    }
    async fetchSearch(req: N.SearchRequest): Promise<N.SearchResponse> {
        const resp = await this.searchCache.fetch(req)
        const result = {
            ...resp,
            results: resp.results.map((x) => this.searchLogCache.get(x.id)!),
        }
        return result
    }
    async fetchLog(id: DbN.LogId): Promise<any> {
        return await this.rawCache.fetch(id)
    }
    async fetchMeta(id: DbN.LogId) {
        const { meta } = await this.metaEntriesCache.fetch(id)
        return meta
    }
    async fetchEntries(id: DbN.LogId) {
        const { entries } = await this.metaEntriesCache.fetch(id)
        return entries
    }
    async fetchDetails(id: DbN.LogId) {
        return await this.detailsCache.fetch(id)
    }
    async fetchMetaSummary(id: DbN.LogId) {
        return (await this.detailsCache.fetch(id)).meta
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
    async fetchIndexMap(id: DbN.LogId) {
        return this.indexMapCache.fetch(id)
    }
    // #region remote prefetch
    async prefetchMeta(id: DbN.LogId) {
        this.fetchMeta(id)
    }
    async prefetchLog(id: DbN.LogId) {
        this.fetchLog(id)
    }
    async prefetchEntries(id: DbN.LogId) {
        this.fetchEntries(id)
    }
    async prefetchDetails(id: DbN.LogId) {
        this.fetchDetails(id)
    }
    async prefetchSearch(req: N.SearchRequest) {
        this.fetchSearch(req)
    }
    // #endregion

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
                    importedAt: null,
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
    private rawCache = new N.AsyncCache<string, string>({
        ttl: null,
        fromRaw: (x) => x,
        toRaw: (x) => x,
        fetch: async (id: DbN.LogId) => {
            const url = this.HVDATA_URL + `/api/battle_logs/${id}` + `?raw=1`
            const resp = await fetch(url).then(async (resp) => resp.json())
            return resp.log
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
    private indexMapCache = new N.AsyncCache<DbN.LogId, IndexMap>({
        toRaw: (req) => JSON.stringify(req),
        fromRaw: (raw) => JSON.parse(raw),
        ttl: null,
        size: 10,
        fetch: async (id: DbN.LogId) => {
            const details = await this.fetchDetails(id)
            return new IndexMap(
                details.meta.turnIndices,
                details.meta.roundIndices,
                details.meta.eventCount,
            )
        },
    })
    // #endregion
}
// #endregion

// #region local
const newLocalCache = <T>(
    self: LogSourceLocal,
    opts: {
        fetch: (db: LogDb<true>, conn: LogDbConn, id: DbN.LogId) => Promise<T>
        size?: number
        ttl?: number | null
    },
) =>
    new N.AsyncCache<DbN.LogId, T>({
        ttl: opts.ttl ?? null,
        size: opts.size,
        fromRaw: (raw) => JSON.parse(raw),
        toRaw: (k) => JSON.stringify(k),
        fetch: async (k) => {
            const db = await self.db
            const conn = await db.conn
            return opts.fetch(db, conn, k)
        },
    })
class LogSourceLocal implements N.Protocol {
    ainit: Promise<void>
    db: Promise<LogDb<true>>
    prices: Promise<UserscriptConfig["prices"]>
    mgr: LogDbCache
    private logIds: Set<DbN.LogId>
    private bcSub: Unsub

    constructor(prices: Promise<UserscriptConfig["prices"]>) {
        this.db = new LogDb().connect()
        this.logIds = new Set<DbN.LogId>()
        this.prices = prices
        this.mgr = LOG_DB_CACHE()

        const self: LogSourceLocal = this
        this.bcSub = DbN.listenIdbEvent((ev, details) => {
            switch (ev.type) {
                case DbN.IDB_LOG_INSERT_EVENT:
                    for (const id of ev.ids) {
                        self.logIds.add(id)
                    }
                    break
                case "hvlog_config_change":
                    this.prices = prices
                    break
            }
        })

        this.ainit = (async () => {
            const conn = await (await this!.db).conn
            for (const id of await conn.getAllKeys("logsMeta")) {
                this!.logIds.add(id)
            }
        })()
    }

    async fetchLogIds(): Promise<string[]> {
        return [...this.logIds]
    }
    async fetchMeta(id: DbN.LogId) {
        return await this.mgr.metaCache.fetch(id)
    }
    async fetchLog(id: DbN.LogId) {
        return await this.mgr.rawCache.fetch(id)
    }
    async fetchDetails(id: DbN.LogId) {
        return (await this.mgr.entriesDetailsCache.fetch(id)).details
    }
    async fetchMetaSummary(id: DbN.LogId) {
        return (
            await this.mgr.metaSearchCache.fetch({
                id,
                prices: await this.prices,
            })
        ).meta
    }
    async fetchSearch(req: N.SearchRequest): Promise<N.SearchResponse> {
        return await this.searchResponseCache.fetch(req)
    }
    async fetchEntries(id: DbN.LogId) {
        return (await this.mgr.entriesDetailsCache.fetch(id)).entries
    }
    async fetchPrices(world: DbN.HvWorld) {
        return (await this.prices)[world]
    }
    async fetchMonlab(): Promise<any> {
        throw new Error("not implemented")
    }
    async fetchGlobalMonsterSummary(): Promise<any> {
        throw new Error("not implemented")
    }
    async fetchIndexMap(id: DbN.LogId) {
        return this.indexMapCache.fetch(id)
    }

    private static FILTER_CONDITIONS = {
        battleType: (d, s, m, ms) =>
            d.some((bt) => s.meta.battleType?.id === bt),
        primaryStyle: (d, s, m, ms) =>
            d.some((style) => style === s.style.primary),
        secondaryStyle: (d, s, m, ms) =>
            d.some((style) => style === s.style.secondary),
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

    // #region local prefetch
    async prefetchMeta(id: DbN.LogId) {
        this.mgr.metaCache.fetch(id, true)
    }
    async prefetchLog(id: DbN.LogId) {
        this.mgr.rawCache.fetch(id, true)
    }
    async prefetchEntries(id: DbN.LogId) {
        this.mgr.entriesDetailsCache.fetch(id, true)
    }
    async prefetchDetails(id: DbN.LogId) {
        this.mgr.entriesDetailsCache.fetch(id, true)
    }
    async prefetchSearch(req: N.SearchRequest) {
        this.searchResponseCache.fetch(req, true)
    }
    // #endregion

    // #region local caches

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

            const ids: Array<DbN.LogId> = []

            let toFetch = Promise.resolve<any>(null)
            const pushToFetch = (id: DbN.LogId) => {
                toFetch = toFetch.then(async () => {
                    const lock = await LOG_PROCESSING_LOCK.acquire()
                    await this.mgr.metaSearchCache.fetch({
                        id,
                        prices: await this.prices,
                    })
                    lock.release()
                })
            }

            const xs: Array<{ meta: MetaSummary; search: SearchSummary }> = []
            for (const id of this.logIds) {
                const fromCache = this.mgr.metaSearchCache.cache.get({
                    id,
                    prices: await this.prices,
                })?.data
                if (fromCache) {
                    xs.push(fromCache)
                    ids.push(id)
                } else {
                    pushToFetch(id)
                }
            }
            const hasPending = xs.length !== this.logIds.size

            const metas = await Promise.all(
                ids.map((id) => this.mgr.metaCache.fetch(id)),
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
                ttl: (hasPending ? 0.25 : 10) * 1000,
                stale: hasPending,
            }
        },
    })
    private indexMapCache = new N.AsyncCache<DbN.LogId, IndexMap>({
        toRaw: (req) => JSON.stringify(req),
        fromRaw: (raw) => JSON.parse(raw),
        ttl: null,
        size: 10,
        fetch: async (id: DbN.LogId) => {
            const details = await this.fetchDetails(id)
            return new IndexMap(
                details.meta.turnIndices,
                details.meta.roundIndices,
                details.meta.eventCount,
            )
        },
    })
    // #endregion
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

    return IS_REMOTE ? new LogSourceRemote() : new LogSourceLocal(prices)
})
