import { CompleteLog, LogMeta } from "@/lib/logDb/schema"
import { SearchSummary } from "@/lib/searchSummary"
import { summarizeFinances } from "@/lib/stats/dropStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { MetaSummary } from "@/lib/stats/metaStats"
import { DetailsSummary } from "@/lib/summary"
import { newContext } from "@/lib/utils/miscUtils"
import { CustomMap, sleep, zip } from "myutils"

export interface TLogSource {
    fetchLog: (id: string) => Promise<CompleteLog<any>>
    fetchDetails: (id: string) => Promise<DetailsSummary>
    fetchSearch: (req: LogSearchRequest) => Promise<LogSearchResponse>
}

export interface LogSearchRequest {
    pageIdx: number
    pageSize?: number
    battleType?: string[] | null
    primaryStyle?: string | null
    secondaryStyle?: string | null
    isImperil?: boolean | null
    startDate?: string | null
    endDate?: string | null
    errors?: Record<keyof MetaSummary["errors"], boolean | null> | null
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

    private summaryCache = new Map<string, Dated<DetailsSummary>>()
    private summaryPending = new Map<string, Promise<DetailsSummary>>()

    private searchCache = new CustomMap<
        LogSearchRequest,
        Dated<LogSearchResponse>,
        string
    >({
        toRaw: (k) => this.toSearchKey(k),
        fromRaw: (k) => this.fromSearchKey(k),
    })
    private searchPending = new CustomMap<
        LogSearchRequest,
        Promise<LogSearchResponse>,
        string
    >({
        toRaw: (k) => this.toSearchKey(k),
        fromRaw: (k) => this.fromSearchKey(k),
    })

    constructor(apiData: typeof window.HV_LOG.apiData) {
        for (const [log, d] of zip(
            apiData?.logs ?? [],
            apiData?.details ?? [],
        )) {
            this.logCache.set(log.id, {
                data: log,
                createdAt: new Date(),
            })

            this.summaryCache.set(log.id, {
                data: {
                    meta: d.meta,
                    combat: d.combat,
                    drops: d.drops,
                    usage: d.usage,
                    finances: summarizeFinances(
                        d.meta,
                        d.drops,
                        d.usage,
                        apiData.prices!,
                    ),
                    indexMap: new IndexMap(
                        d.meta.turnIndices,
                        d.meta.roundIndices,
                        d.meta.eventCount,
                    ),
                },
                createdAt: new Date(),
            })
        }
    }

    async fetchSearch(req: LogSearchRequest) {
        const k = req
        if (this.searchCache.has(k)) {
            const fromCache = this.searchCache.get(k)!
            if (!isExpired(fromCache, this.SEARCH_TTL)) {
                return fromCache.data
            }
        }

        if (!this.searchPending.has(k)) {
            const resp = fetch(this.HVDATA_URL + "/search_logs", {
                method: "POST",
                body: JSON.stringify(req),
                headers: {
                    "Content-Type": "application/json",
                },
            }).then((resp) => resp.json())
            this.searchPending.set(k, resp)
        }

        const result = await this.searchPending.get(k)!
        this.searchCache.set(k, {
            data: result,
            createdAt: new Date(),
        })
        this.searchPending.delete(k)

        return result
    }

    async fetchLog(id: string) {
        if (this.logCache.has(id)) {
            return this.logCache.get(id)!.data
        }
        throw new Error("not implemented")
    }

    async fetchDetails(id: string) {
        if (this.summaryCache.has(id)) {
            return this.summaryCache.get(id)!.data
        }
        throw new Error("not implemented")
    }

    private toSearchKey(k: LogSearchRequest) {
        return JSON.stringify(k)
    }
    private fromSearchKey(raw: string): LogSearchRequest {
        return JSON.parse(raw)
    }
}

export const LOG_SOURCE = newContext<TLogSource>(() =>
    "apiData" in window.HV_LOG
        ? new LogSourceRemote(window.HV_LOG.apiData)
        : (null as any),
)

function isExpired<T>(x: Dated<T>, thresholdMs: number): boolean {
    const createdAt = x.createdAt.getTime()
    const now = new Date().getTime()
    const elapsed = now - createdAt
    return elapsed > thresholdMs
}
