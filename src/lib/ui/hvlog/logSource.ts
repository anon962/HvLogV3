import { CompleteLog, LogMeta } from "@/lib/logDb/schema"
import { SearchSummary } from "@/lib/searchSummary"
import { summarizeFinances } from "@/lib/stats/dropStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { MetaSummary } from "@/lib/stats/metaStats"
import { DetailsSummary } from "@/lib/summary"
import { newContext } from "@/lib/utils/miscUtils"
import { CustomMap, zip } from "myutils"

export interface TLogSource {
    fetchLog: (id: string) => Promise<CompleteLog<any>>
    fetchDetails: (id: string) => Promise<DetailsSummary>
    fetchSearch: (req: LogSearchRequest) => Promise<LogSearchResponse>
}

export interface LogSearchRequest {
    page: number
    pageSize?: number
    battleType?: string[] | null
    primaryStyle?: string | null
    secondaryStyle?: string | null
    isImperil?: boolean | null
    startDate?: string | null
    endDate?: string | null
    errors?: Record<keyof MetaSummary["errors"], boolean | null> | null

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

class LogSourceRemote {
    private HVDATA_URL = "https://hvdata.gisadan.dev"
    // private HVDATA_URL = "http://localhost:4546" // @DEBUG

    private logCache = new Map<string, CompleteLog>()

    private summaryCache = new Map<string, DetailsSummary>()
    private summaryPending = new Map<string, Promise<DetailsSummary>>()

    private sep = "|LogSourceRemote|"
    private searchCache = new CustomMap<
        LogSearchRequest,
        LogSearchResponse,
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
            this.logCache.set(log.id, log)

            this.summaryCache.set(log.id, {
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
            })
        }
    }

    async fetchSearch(req: LogSearchRequest) {
        const k = req
        if (this.searchCache.has(k)) {
            return this.searchCache.get(k)
        } else {
            const resp = fetch(this.HVDATA_URL + "/search_logs", {
                method: "POST",
                body: JSON.stringify(req),
                headers: {
                    "Content-Type": "application/json",
                },
            }).then((resp) => resp.json())
            this.searchPending.set(k, resp)

            const result = await resp
            this.searchCache.set(k, result)

            // @todo: prefetch
            return result
        }
    }

    searchFromCache(req: LogSearchRequest) {
        const k = req
        if (this.searchCache.has(k)) {
            return this.searchCache.get(k)
        }

        return null
    }

    async fetchLog(id: string) {
        if (this.logCache.has(id)) {
            return this.logCache.get(id)!
        }
        throw new Error("not implemented")
    }

    async fetchDetails(id: string) {
        if (this.summaryCache.has(id)) {
            return this.summaryCache.get(id)!
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
