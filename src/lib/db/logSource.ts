import { DbN, LogEntry } from "@/lib/db/dbN"
import { DetailsSummary } from "@/lib/stats/summary"
import { newContext } from "@/lib/utils/miscUtils"
import { compressGzip, sleep } from "myutils"
import { IS_REMOTE } from "../ui/constants"
import { LogSourceN as N } from "./logSourceN"

// region: remote
class LogSourceRemote {
    private HVDATA_URL = ""

    private prices: Promise<Record<string, number>> | null = null
    private globalMonsterSummary: Promise<any> | null = null
    private monlab: Promise<Record<number, N.MonlabMonster>> | null = null

    constructor() {}

    async fetchSearch(req: N.SearchRequest): Promise<N.SearchResponse> {
        const resp = await this.searchCache.fetch(req)
        const result = {
            ...resp,
            results: resp.results.map((x) => this.searchLogCache.get(x.id)!),
        }
        return result
    }

    async fetchLog() {
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

    // region: remote caches
    private metaEntriesCache = new N.AsyncCache<
        DbN.LogId,
        { meta: DbN.LogMeta; entries: Array<LogEntry> }
    >({
        ttl: null,
        toRaw: (x) => x,
        fromRaw: (x) => x,
        fetch: async (id: DbN.LogId) => {
            const url = this.HVDATA_URL + `/api/battle_logs/${id}` + `?events=1`
            const resp = await fetch(url).then(async (resp) => resp.json())
            return {
                meta: {
                    start: resp.created_at.replace("+00:00", "") + "Z",
                    lastUpdate: resp.created_at.replace("+00:00", "") + "Z",
                    version: resp.version,
                    world: "persistent",
                    user_id: resp.id_user,
                    user_name: resp.name,
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
}

export const LOG_SOURCE = newContext<N.Protocol>(() => [
    IS_REMOTE ? new LogSourceRemote() : (null as any),
    () => {},
])
