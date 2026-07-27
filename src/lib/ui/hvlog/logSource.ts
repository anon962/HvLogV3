import { CompleteLog, LogMeta } from "@/lib/logDb/schema"
import { SearchSummary } from "@/lib/searchSummary"
import { summarizeFinances } from "@/lib/stats/dropStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { MetaSummary } from "@/lib/stats/metaStats"
import { DetailsSummary } from "@/lib/detailsSummary"
import { newContext } from "@/lib/utils/miscUtils"
import { compressGzip, CustomMap, sleep, zip } from "myutils"
import { IS_REMOTE } from "../constants"

export interface TLogSource {
    fetchLog: (id: string) => Promise<CompleteLog<any>>
    fetchDetails: (id: string) => Promise<DetailsSummary>
    fetchSearch: (req: LogSearchRequest) => Promise<LogSearchResponse>
}

export interface LogSearchRequest {
    pageIdx: number

    seen?: string[]
    pageSize?: number
    battleType?: string[] | null
    primaryStyle?: string[] | null
    secondaryStyle?: string[] | null
    isImperil?: boolean | null
    startDate?: string | null
    endDate?: string | null
    errors?: Record<keyof MetaSummary["errors"] | "none", boolean | null> | null
    completionType?: string[] | null
    idUser?: string | null
    keyUser?: string | null

    sort?:
        | ({
              type: "date" | "profit" | "turns"
          } & {
              order?: "asc" | "desc" | null
          })
        | null
}

export interface LogSearchResponse {
    currPage: number
    lastPage: number
    resultCount: number
    pageSize: number
    results: Array<LogSearchResult>
}

export interface LogSearchResult {
    id: string
    meta: LogMeta
    search: SearchSummary
}

interface Dated<T> {
    data: T
    createdAt: Date
}

class LogSourceRemote {
    private HVDATA_URL = "https://hvdata.gisadan.dev"
    // private HVDATA_URL = "http://localhost:4546" // @DEBUG

    private SEARCH_TTL = 5 * 60 * 1000

    private logCache = new Map<string, Dated<CompleteLog>>()
    private logPending = new Map<string, Promise<any>>()

    private detailsCache = new Map<string, Dated<DetailsSummary>>()
    private detailsPending = new Map<string, Promise<any>>()

    private searchRequestCache = new CustomMap<
        LogSearchRequest,
        Dated<LogSearchResponse>,
        string
    >({
        toRaw: (k) => this.toSearchKey(k),
        fromRaw: (k) => this.fromSearchKey(k),
    })
    private searchLogCache = new Map<string, LogSearchResult>()
    private searchPending = new CustomMap<
        LogSearchRequest,
        Promise<LogSearchResponse>,
        string
    >({
        toRaw: (k) => this.toSearchKey(k),
        fromRaw: (k) => this.fromSearchKey(k),
    })

    constructor() {}

    private async _fetchSearch(req: LogSearchRequest) {
        const k = req
        if (this.searchRequestCache.has(k)) {
            const fromCache = this.searchRequestCache.get(k)!
            if (!isExpired(fromCache, this.SEARCH_TTL)) {
                return fromCache.data
            }
        }

        if (!this.searchPending.has(k)) {
            // console.log(req)
            const resp = fetch(this.HVDATA_URL + "/search_logs", {
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
            }).then((resp) => resp.json())
            this.searchPending.set(k, resp)
        }

        const resp = await this.searchPending.get(k)!
        for (const log of resp.results) {
            if (this.searchLogCache.has(log.id)) {
                continue
            }

            this.searchLogCache.set(log.id, { ...log })
            for (const k of Object.keys(log)) {
                if (k !== "id") {
                    // @ts-ignore
                    delete log[k]
                }
            }
        }
        this.searchRequestCache.set(k, {
            data: resp,
            createdAt: new Date(),
        })
        this.searchPending.delete(k)

        return resp
    }

    async fetchSearch(req: LogSearchRequest): Promise<LogSearchResponse> {
        const resp = await this._fetchSearch(req)
        const result = {
            ...resp,
            results: resp.results.map((x) => this.searchLogCache.get(x.id)!),
        }
        return result
    }

    async fetchLog(id: string) {
        const k = id
        if (this.logCache.has(k)) {
            return this.logCache.get(k)!.data
        }

        if (!this.logPending.has(k)) {
            const url =
                this.HVDATA_URL +
                `/battle_logs/${id}` +
                `?raw=0&events=1&details=0&search=0`
            const resp = await fetch(url).then(async (resp) => resp.json())

            this.logPending.set(k, resp)
        }

        const resp = await this.logPending.get(k)!
        const log: CompleteLog = {
            id: resp.id,
            meta: {
                start: resp.created_at.replace("+00:00", "") + "Z",
                lastUpdate: resp.created_at.replace("+00:00", "") + "Z",
                version: -999,
                world: "persistent",
                user_id: resp.id_user,
                user_name: resp.name,
            },
            entries: resp.parsed.events.entries,
        }
        this.logCache.set(id, {
            data: log,
            createdAt: new Date(),
        })
        this.logPending.delete(k)

        return log
    }

    async fetchDetails(id: string) {
        const k = id
        if (this.detailsCache.has(k)) {
            return this.detailsCache.get(k)!.data
        }

        if (!this.detailsPending.has(k)) {
            const url =
                this.HVDATA_URL +
                `/battle_logs/${id}` +
                `?raw=0&events=0&details=1&search=0`
            const resp = await fetch(url).then(async (resp) => resp.json())

            this.detailsPending.set(k, resp.parsed.details)
        }

        const result = await this.detailsPending.get(k)!
        this.detailsCache.set(id, {
            data: result,
            createdAt: new Date(),
        })
        this.detailsPending.delete(k)

        return result
    }

    private toSearchKey(k: LogSearchRequest) {
        return JSON.stringify(k)
    }
    private fromSearchKey(raw: string): LogSearchRequest {
        return JSON.parse(raw)
    }
}

export const LOG_SOURCE = newContext<TLogSource>(() => [
    IS_REMOTE ? new LogSourceRemote() : (null as any),
    () => {},
])

function isExpired<T>(x: Dated<T>, thresholdMs: number): boolean {
    const createdAt = x.createdAt.getTime()
    const now = new Date().getTime()
    const elapsed = now - createdAt
    return elapsed > thresholdMs
}
