import { createContext, useContext, useEffect } from "react"
import { CompleteLog, LogId } from "../../logDb"
import {
    CombatSummary,
    summarizeCombatUsage,
} from "../../stats/combatStats"
import {
    DropSummary,
    FinanceSummary,
    summarizeFinances,
    summarizeItemDrops,
} from "../../stats/dropStats"
import { IndexMap } from "../../stats/indexMap"
import {
    ItemUsageSummary,
    summarizeItemUsage,
} from "../../stats/itemUsageStats"
import { LogSummary, SummaryDb } from "../../summaryDb"
import { ContextProviderProps } from "../../utils/typeUtils"
import { useAppContext } from "../appContext"
import { useLogContext } from "./logContext"
import { useSummaryDbContext } from "./summaryDbContext"

const ctx = createContext<ReturnType<typeof initContext>>(null as any)

const CACHE_VERSION = 1

export function useLogStatsContext() {
    return useContext(ctx)
}

export function LogStatsProvider({ children }: ContextProviderProps) {
    const db = useSummaryDbContext()
    const value = initContext(db)
    return <ctx.Provider value={value}>{children}</ctx.Provider>
}

function initContext(summaryDb: SummaryDb) {
    const app = useAppContext()

    const getSummary = (log: CompleteLog) => summaryDb.get(log)

    const indexMap = useCache((log) => {
        const summary = summaryDb.get(log)
        return new IndexMap(
            summary.turnIndexes,
            summary.roundIndexes,
            summary.numEvents
        )
    })

    const getIndexMapMaybe = (logId: LogId) => {
        if (indexMap.cache.has(logId)) {
            return indexMap.cache.get(logId)!
        }

        const summary = summaryDb.getMaybe(logId)
        if (!summary) return null

        const result = new IndexMap(
            summary.turnIndexes,
            summary.roundIndexes,
            summary.numEvents
        )
        indexMap.cache.set(logId, result)
        return result
    }

    const itemDrops = useCache((log) => summarizeItemDrops(app, log))

    const itemUsage = useCache((log) => summarizeItemUsage(app, log))

    const combatUsage = useCache((log) => summarizeCombatUsage(log))

    const money = useCache((log) => {
        return summarizeFinances(
            getSummary(log),
            itemDrops.get(log),
            itemUsage.get(log),
            app
        )
    }, "hvlog_stats_finances")

    function maybeGetter<T extends ReturnType<typeof useCache>>(
        cache: T
    ) {
        return (logId: LogId) => cache.cache.get(logId) ?? null
    }

    return {
        summaryDb,
        getSummary,
        getIndexMap: indexMap.get,
        getIndexMapMaybe,
        getItemDrops: itemDrops.get,
        getItemDropsMaybe: maybeGetter(itemDrops),
        getItemUsage: itemUsage.get,
        getItemUsageMaybe: maybeGetter(itemUsage),
        getCombatUsage: combatUsage.get,
        getCombatUsageMaybe: maybeGetter(combatUsage),
        getFinances: money.get,
        getFinancesMaybe: maybeGetter(money),
    }
}

function useCache<T>(
    generate: (log: CompleteLog) => T,
    storageKey: string | null = null
): {
    cache: Map<LogId, T>
    get: (log: CompleteLog) => T
} {
    const cache: Map<LogId, T> = storageKey
        ? load(storageKey) ?? new Map()
        : new Map()

    const get = (log: CompleteLog) => {
        if (!cache.has(log.id)) {
            cache.set(log.id, generate(log))

            if (storageKey) {
                save(storageKey, cache)
            }
        }

        return cache.get(log.id)!
    }

    return { cache, get }

    function load(storageKey: string) {
        const raw = localStorage.getItem(storageKey)
        if (!raw) {
            return
        }

        const data = JSON.parse(raw)
        if (data.version !== CACHE_VERSION) {
            return
        }

        const cache = new Map<LogId, T>()
        for (const [k, v] of Object.entries(data.cache)) {
            cache.set(k, v as any)
        }

        return cache
    }

    function save(storageKey: string, cache: Map<LogId, T>) {
        const data = {
            version: CACHE_VERSION,
            cache: Object.fromEntries(cache.entries()),
        }
        localStorage.setItem(storageKey, JSON.stringify(data))
    }
}

export interface UseStatsOptions {
    summary?: boolean
    indexMap?: boolean
    itemDrops?: boolean
    itemUsage?: boolean
    combatUsage?: boolean
    finances?: boolean
}

// prettier-ignore
export type UseStatsReturn<Opts extends UseStatsOptions> = {
    [K in keyof Opts]:  
        K extends 'summary' ? Opts[K] extends true ?
            LogSummary : undefined :
        K extends 'indexMap' ? Opts[K] extends true ?
            IndexMap : undefined :
        K extends 'itemDrop' ? Opts[K] extends true ?
            DropSummary : undefined :
        K extends 'itemUsage' ? Opts[K] extends true ?
            ItemUsageSummary : undefined :
        K extends 'combatUsage' ? Opts[K] extends true ?
            CombatSummary : undefined :
        K extends 'finances' ? Opts[K] extends true ?
            FinanceSummary : undefined :
        never
}

export function useStats<T extends UseStatsOptions>(
    log: CompleteLog,
    opts: T
): UseStatsReturn<T> {
    const ctx = useLogStatsContext()

    return {
        summary: opts.summary ? ctx.getSummary(log) : undefined,
        indexMap: opts.indexMap ? ctx.getIndexMap(log) : undefined,
        itemDrops: opts.itemDrops ? ctx.getItemDrops(log) : undefined,
        itemUsage: opts.itemUsage ? ctx.getItemUsage(log) : undefined,
        combatUsage: opts.combatUsage
            ? ctx.getCombatUsage(log)
            : undefined,
        finances: opts.finances ? ctx.getFinances(log) : undefined,
    } as UseStatsReturn<T>
}

// prettier-ignore
export type UseStatsMaybeReturn<Opts extends UseStatsOptions> = {
    [K in keyof Opts]:  
        K extends 'summary' ? Opts[K] extends true ?
            LogSummary | null : undefined :
        K extends 'indexMap' ? Opts[K] extends true ?
            IndexMap | null : undefined :
        K extends 'itemDrop' ? Opts[K] extends true ?
            DropSummary | null : undefined :
        K extends 'itemUsage' ? Opts[K] extends true ?
            ItemUsageSummary | null : undefined :
        K extends 'combatUsage' ? Opts[K] extends true ?
            CombatSummary | null : undefined :
        K extends 'finances' ? Opts[K] extends true ?
            FinanceSummary | null : undefined :
        never
}

export function useStatsMaybe<T extends UseStatsOptions>(
    id: LogId,
    opts: T
): UseStatsMaybeReturn<T> {
    const ctx = useLogStatsContext()

    const { useLogFetch } = useLogContext()
    const fetcher = useLogFetch(null)

    const result = {} as any
    let needsFetch = false
    if (opts.summary) {
        result.summary = ctx.summaryDb.getMaybe(id) ?? null
    }
    if (opts.indexMap) {
        result.indexMap = ctx.getIndexMapMaybe(id)
        if (!result.indexMap) needsFetch = true
    }
    if (opts.itemDrops) {
        result.itemDrops = ctx.getItemDropsMaybe(id)
        if (!result.itemDrops) needsFetch = true
    }
    if (opts.itemUsage) {
        result.itemUsage = ctx.getItemUsageMaybe(id)
        if (!result.itemUsage) needsFetch = true
    }
    if (opts.combatUsage) {
        result.combatUsage = ctx.getCombatUsageMaybe(id)
        if (!result.combatUsage) needsFetch = true
    }
    if (opts.finances) {
        result.finances = ctx.getFinancesMaybe(id)
        if (!result.finances) needsFetch = true
    }

    useEffect(() => {
        if (needsFetch) {
            fetcher.setLogId(id)
        }
    }, [needsFetch])

    return result
}
