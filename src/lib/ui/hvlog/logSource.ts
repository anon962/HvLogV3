import { CompleteLog, ISODate, LogMeta } from "@/lib/db/schema"
import { MetaSummary } from "@/lib/stats/metaStats"
import {
    DetailsSummary,
    GlobalMonsterSummary,
    SearchSummary,
} from "@/lib/summary"
import { newContext } from "@/lib/utils/miscUtils"
import { compressGzip, CustomMap, sleep } from "myutils"
import { IS_REMOTE } from "../constants"

export interface TLogSource {
    fetchLog: (id: string) => Promise<CompleteLog<any>>
    fetchDetails: (id: string) => Promise<DetailsSummary>
    fetchSearch: (req: LogSearchRequest) => Promise<LogSearchResponse>

    fetchPrices: () => Promise<Record<string, number>>
    fetchGlobalMonsterSummary: () => Promise<GlobalMonsterSummary>
    fetchMonlab: () => Promise<Record<number, MonlabMonster>>
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

export interface MonlabMonster {
    monsterId: number
    created_at: ISODate
    monsterClass: string
    monsterName: string
    plvl: number
    attack: string
    trainer: string
    piercing: number
    crushing: number
    slashing: number
    cold: number
    wind: number
    elec: number
    fire: number
    dark: number
    holy: number
    lastUpdate: string
}

interface Dated<T> {
    data: T
    createdAt: Date
}

class LogSourceRemote {
    private HVDATA_URL = ""
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

    private prices: Promise<Record<string, number>> | null = null
    private globalMonsterSummary: Promise<any> | null = null
    private monlab: Promise<Record<number, MonlabMonster>> | null = null

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
            const resp = fetch(this.HVDATA_URL + "/api/search_logs", {
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
            const url = this.HVDATA_URL + `/api/battle_logs/${id}` + `?events=1`
            const resp = await fetch(url).then(async (resp) => resp.json())

            this.logPending.set(k, resp)
        }

        const resp = await this.logPending.get(k)!
        const log: CompleteLog = {
            id: resp.id,
            meta: {
                start: resp.created_at.replace("+00:00", "") + "Z",
                lastUpdate: resp.created_at.replace("+00:00", "") + "Z",
                version: resp.version,
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
                this.HVDATA_URL + `/api/battle_logs/${id}` + `?details=1`
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
                const data: Array<MonlabMonster> = await resp.json()
                const byMid = data.reduce(
                    (acc, x) => {
                        acc[x.monsterId] = x
                        return acc
                    },
                    {} as Record<number, MonlabMonster>,
                )
                return byMid
            })
        }

        return this.monlab
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
