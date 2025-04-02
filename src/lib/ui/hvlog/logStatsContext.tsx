import { createContext, useContext } from "react"
import { CompleteLog, LogId } from "../../logDb"
import {
    CombatSummary,
    summarizeCombatUsage,
} from "../../stats/combatStats"
import {
    DropSummary,
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
import { useSummaryDbContext } from "./summaryDbContext"

const ctx = createContext<ReturnType<typeof initContext>>(null as any)

export function useLogStatsContext() {
    return useContext(ctx)
}

export function LogStatsProvider({ children }: ContextProviderProps) {
    const db = useSummaryDbContext()
    const value = initContext(db)
    return <ctx.Provider value={value}>{children}</ctx.Provider>
}

function initContext(db: SummaryDb) {
    const app = useAppContext()

    const getSummary = (log: CompleteLog) => db.get(log)

    const { get: getIndexMap } = useCache((log) => {
        const { roundIndexes, turnIndexes } = db.get(log)
        return new IndexMap(
            turnIndexes,
            roundIndexes,
            log.entries.length
        )
    })

    const { get: getItemDrops } = useCache((log) =>
        summarizeItemDrops(app, log)
    )
    const { get: getItemUsage } = useCache((log) =>
        summarizeItemUsage(app, log)
    )
    const { get: getCombatUsage } = useCache((log) =>
        summarizeCombatUsage(log)
    )

    return {
        getSummary,
        getIndexMap,
        getItemDrops,
        getItemUsage,
        getCombatUsage,
    }
}

function useCache<T>(generate: (log: CompleteLog) => T): {
    cache: Map<LogId, T>
    get: (log: CompleteLog) => T
} {
    const cache = new Map<LogId, T>()

    const get = (log: CompleteLog) => {
        if (!cache.has(log.id)) {
            cache.set(log.id, generate(log))
        }

        return cache.get(log.id)!
    }

    return { cache, get }
}

export interface UseStatsOptions {
    summary?: boolean
    indexMap?: boolean
    itemDrops?: boolean
    itemUsage?: boolean
    combatUsage?: boolean
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
    } as UseStatsReturn<T>
}
