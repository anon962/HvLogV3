import {
    DetailsSummary,
    GlobalMonsterSummary,
    SearchSummary,
} from "@/lib/stats/summary"
import { CustomMap, ISODate } from "myutils"
import { MetaSummary } from "../stats/metaStats"
import { DbN, LogEntry } from "./dbN"

export namespace LogSourceN {
    export interface Protocol {
        fetchLogIds(): Promise<string[]>
        fetchMeta: (id: string) => Promise<DbN.LogMeta>
        fetchLog: (id: string) => Promise<string>
        fetchEntries: (id: string) => Promise<Array<LogEntry>>
        fetchDetails: (id: string) => Promise<DetailsSummary>
        fetchSearch: (req: SearchRequest) => Promise<SearchResponse>

        fetchPrices: () => Promise<Record<string, number>>
        fetchGlobalMonsterSummary: () => Promise<GlobalMonsterSummary>
        fetchMonlab: () => Promise<Record<number, MonlabMonster>>
    }

    export interface SearchRequest {
        pageIdx: number
        pageSize: number

        seen?: string[]
        battleType?: string[] | null
        primaryStyle?: string[] | null
        secondaryStyle?: string[] | null
        isImperil?: boolean | null
        startDate?: string | null
        endDate?: string | null
        errors?: Record<
            keyof MetaSummary["errors"] | "none",
            boolean | null
        > | null
        completionType?: string[] | null
        roundMin?: number | null
        roundMax?: number | null
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
    export interface SearchResponse {
        currPage: number
        lastPage: number
        resultCount: number
        pageSize: number
        results: Array<SearchResult>
        ttl?: number
        stale?: boolean
    }
    export interface SearchResult {
        id: string
        meta: DbN.LogMeta
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

    export interface Dated<T> {
        data: T
        createdAt: Date
    }
    export function isExpired<T>(x: Dated<T>, thresholdMs: number): boolean {
        const createdAt = x.createdAt.getTime()
        const now = new Date().getTime()
        const elapsed = now - createdAt
        return elapsed > thresholdMs
    }

    export class AsyncCache<TReq, TResp, TMapKey extends string = string> {
        cache: CustomMap<TReq, Dated<TResp>, TMapKey>
        pending: CustomMap<TReq, Promise<TResp>, TMapKey>
        history: Array<TReq>

        constructor(
            public opts: {
                ttl: number | null | ((resp: TResp, req: TReq) => number | null)
                toRaw: (req: TReq) => TMapKey
                fromRaw: (raw: TMapKey) => TReq
                fetch: (req: TReq) => Promise<TResp>
                size?: number
            },
        ) {
            this.cache = new CustomMap({
                toRaw: this.opts.toRaw,
                fromRaw: this.opts.fromRaw,
            })
            this.pending = new CustomMap({
                toRaw: this.opts.toRaw,
                fromRaw: this.opts.fromRaw,
            })
            this.history = []
        }

        async fetch(req: TReq): Promise<TResp> {
            if (this.cache.has(req)) {
                // return from cache
                const fromCache = this.cache.get(req)!

                const ttl =
                    typeof this.opts.ttl === "function"
                        ? this.opts.ttl(fromCache.data, req)
                        : this.opts.ttl
                if (ttl === null || !isExpired(fromCache, ttl)) {
                    return fromCache.data
                }
            }

            // send request
            if (this.pending.has(req)) {
                return this.pending.get(req)!
            }
            const respPromise = this.opts.fetch(req)
            this.pending.set(req, respPromise)

            // save response
            const data = await respPromise
            this.cache.set(req, {
                data,
                createdAt: new Date(),
            })
            this.pending.delete(req)

            this.checkOverflow(req)

            return data
        }

        private checkOverflow(req?: TReq) {
            if (!this.opts.size) {
                return
            }

            if (req) {
                this.history.push(req)
            }

            if (this.history.length <= this.opts.size) {
                return
            }

            const overflowIdx = this.history.length - this.opts.size
            const overflow = this.history.slice(0, overflowIdx)
            for (const req of overflow) {
                this.cache.delete(req)
            }
            this.history = this.history.slice(overflowIdx)
        }
    }
}
