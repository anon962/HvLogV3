import {
    extractRoundIndexes,
    extractTurnIndexes,
    filterEvents,
} from "@/lib/stats/summaryStats"
import { enumerate } from "@/lib/utils/miscUtils"
import { createContext, useContext, useMemo } from "react"
import { CompleteLog, LogId } from "../../logDb/logDb"
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
import { EQUIP_PREFIXES } from "../constants"
import { useLogContext } from "./logContext"
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

function initContext(summaryDb: SummaryDb) {
    const app = useAppContext()

    const getSummary = (log: CompleteLog) => summaryDb.get(log)

    const indexMap = useCache((log) => {
        const summary = summaryDb.get(log)

        const turnIndexes = extractTurnIndexes(log)
        const roundIndexes = extractRoundIndexes(log)

        return new IndexMap(
            turnIndexes,
            roundIndexes,
            summary.numEvents
        )
    })

    const itemDrops = useCache((log) => summarizeItemDrops(app, log))

    const itemUsage = useCache((log) => summarizeItemUsage(app, log))

    const combatUsage = useCache((log) => summarizeCombatUsage(log))

    const priceHash = useMemo(
        () => JSON.stringify(app.config.prices),
        [app]
    )
    const money = useCache(
        (log) => {
            return summarizeFinances(
                getSummary(log),
                itemDrops.get(log),
                itemUsage.get(log),
                app
            )
        },
        { key: "hvlog_stats_finances", hash: priceHash }
    )

    const equipDrops = useCache(
        (log) => {
            const equips = filterEvents(log, [
                "DROP",
                "DROP_EVENT",
                "CLEAR_BONUS",
            ]).flatMap((ev) => {
                const isEquip = EQUIP_PREFIXES.some((patt) =>
                    ev.item.startsWith(patt)
                )
                if (!isEquip) {
                    return []
                }

                const isClearBonus = ev.event_type === "CLEAR_BONUS"
                return [
                    {
                        equip: ev.item,
                        isClearBonus: isClearBonus,
                    },
                ]
            })

            return equips
        },
        { key: "hvlog_stats_drops" }
    )

    function maybeGetter<T extends ReturnType<typeof useCache>>(
        cache: T
    ) {
        return (logId: LogId) => cache.cache.get(logId) ?? null
    }

    return {
        summaryDb,
        getSummary,
        getIndexMap: indexMap.get,
        getItemDrops: itemDrops.get,
        getItemDropsMaybe: maybeGetter(itemDrops),
        getEquipDrops: equipDrops.get,
        getEquipDropsMaybe: maybeGetter(equipDrops),
        getItemUsage: itemUsage.get,
        getItemUsageMaybe: maybeGetter(itemUsage),
        getCombatUsage: combatUsage.get,
        getCombatUsageMaybe: maybeGetter(combatUsage),
        getFinances: money.get,
        getFinancesMaybe: maybeGetter(money),
    }
}

interface StorageMeta {
    key: string
    hash?: string
}

function useCache<T>(
    generate: (log: CompleteLog) => T,
    storage?: StorageMeta
): {
    cache: Map<LogId, T>
    get: (log: CompleteLog) => T
} {
    const cache: Map<LogId, T> = storage
        ? load(storage) ?? new Map()
        : new Map()

    const get = (log: CompleteLog) => {
        if (!cache.has(log.id)) {
            cache.set(log.id, generate(log))

            if (storage) {
                save(storage, cache)
            }
        }

        return cache.get(log.id)!
    }

    return { cache, get }

    function load(storage: StorageMeta) {
        const raw = localStorage.getItem(storage.key)
        if (!raw) {
            return
        }

        const data = JSON.parse(raw)
        if (data.hash !== storage.hash) {
            return
        }

        const cache = new Map<LogId, T>()
        for (const [k, v] of Object.entries(data.cache)) {
            cache.set(k, v as any)
        }

        return cache
    }

    function save(storage: StorageMeta, cache: Map<LogId, T>) {
        const data = {
            hash: storage.hash,
            cache: Object.fromEntries(cache.entries()),
        }
        localStorage.setItem(storage.key, JSON.stringify(data))
    }
}

export interface UseStatsOptions {
    summary?: boolean
    indexMap?: boolean
    itemDrops?: boolean
    equipDrops?: boolean
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
        K extends 'itemDrops' ? Opts[K] extends true ?
            DropSummary : undefined :
        K extends 'equipDrops' ? Opts[K] extends true ?
            Array<{equip: string, isClearBonus: boolean}> : undefined :
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
        equipDrops: opts.equipDrops
            ? ctx.getEquipDrops(log)
            : undefined,
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
        K extends 'itemDrops' ? Opts[K] extends true ?
            DropSummary | null : undefined :
        K extends 'equipDrops' ? Opts[K] extends true ?
            Array<{equip: string, isClearBonus: boolean}> | null : undefined :
        K extends 'itemUsage' ? Opts[K] extends true ?
            ItemUsageSummary | null : undefined :
        K extends 'combatUsage' ? Opts[K] extends true ?
            CombatSummary | null : undefined :
        K extends 'finances' ? Opts[K] extends true ?
            FinanceSummary | null : undefined :
        never
}

export function useStatsMaybe<T extends UseStatsOptions>(
    ids: LogId[],
    opts: T
) {
    const ctx = useLogStatsContext()

    const { useLogFetch } = useLogContext()

    const stats: Array<UseStatsMaybeReturn<T>> = []
    const toFetch: LogId[] = []

    for (const id of ids) {
        const d = {} as any
        let needsFetch = false

        if (opts.summary) {
            d.summary = ctx.summaryDb.getMaybe(id) ?? null
            if (!d.summary) needsFetch = true
        }
        if (opts.indexMap) {
            d.indexMap = null
            needsFetch = true
        }
        if (opts.itemDrops) {
            d.itemDrops = ctx.getItemDropsMaybe(id)
            if (!d.itemDrops) needsFetch = true
        }
        if (opts.equipDrops) {
            d.equipDrops = ctx.getEquipDropsMaybe(id)
            if (!d.equipDrops) needsFetch = true
        }
        if (opts.itemUsage) {
            d.itemUsage = ctx.getItemUsageMaybe(id)
            if (!d.itemUsage) needsFetch = true
        }
        if (opts.combatUsage) {
            d.combatUsage = ctx.getCombatUsageMaybe(id)
            if (!d.combatUsage) needsFetch = true
        }
        if (opts.finances) {
            d.finances = ctx.getFinancesMaybe(id)
            if (!d.finances) needsFetch = true
        }

        if (needsFetch) {
            toFetch.push(id)
        }

        stats.push(d)
    }

    const fetcher = useLogFetch(toFetch)
    const logMap = Object.fromEntries(
        fetcher.logs.flatMap((log) => (log ? [[log.id, log]] : []))
    )

    for (const [idx, id] of enumerate(ids)) {
        if (!(id in logMap)) {
            continue
        }

        const log = logMap[id]
        stats[idx] = {
            summary: opts.summary ? ctx.getSummary(log) : undefined,
            indexMap: opts.indexMap
                ? ctx.getIndexMap(log)
                : undefined,
            itemDrops: opts.itemDrops
                ? ctx.getItemDrops(log)
                : undefined,
            equipDrops: opts.equipDrops
                ? ctx.getEquipDrops(log)
                : undefined,
            itemUsage: opts.itemUsage
                ? ctx.getItemUsage(log)
                : undefined,
            combatUsage: opts.combatUsage
                ? ctx.getCombatUsage(log)
                : undefined,
            finances: opts.finances
                ? ctx.getFinances(log)
                : undefined,
        } as UseStatsReturn<T>
    }

    return { stats, ids }
}
