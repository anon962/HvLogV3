import { sleep } from "radash"
import { createContext, useContext, useEffect, useState } from "react"
import { CompleteLog, LogDb, LogId } from "../logDb"
import {
    CombatSummary,
    summarizeCombatUsage,
} from "../stats/combatStats"
import {
    UsageSummary as ItemUsageSummary,
    summarizeItemDrops,
} from "../stats/dropStats"
import { IndexMap } from "../stats/indexMap"
import {
    DropSummary,
    summarizeItemUsage,
} from "../stats/itemUsageStats"
import { LogSummary, SummaryDb } from "../summaryDb"

export const LogContext = createContext<
    ReturnType<typeof createLogContext>
>(null as any)

export function useLogContext() {
    return useContext(LogContext)
}

export function createLogContext() {
    const { logs, loading: logsLoading } = useAllLogs()

    const summaryDb = new SummaryDb()
    const getSummary = (log: CompleteLog) => summaryDb.get(log)

    const { get: getIndexMap } = useCache((log) => {
        const { roundIndexes, turnIndexes } = summaryDb.get(log)
        return new IndexMap(
            turnIndexes,
            roundIndexes,
            log.entries.length
        )
    })

    const { get: getItemDrops } = useCache((log) =>
        summarizeItemDrops(log)
    )
    const { get: getItemUsage } = useCache((log) =>
        summarizeItemUsage(log)
    )
    const { get: getCombatUsage } = useCache((log) =>
        summarizeCombatUsage(log)
    )

    return {
        logs,
        logsLoading,
        getSummary,
        getIndexMap,
        getItemDrops,
        getItemUsage,
        getCombatUsage,
    }
}

function useAllLogs(refreshDelay = 5000) {
    const [logs, setLogs] = useState<CompleteLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const result: CompleteLog[] = []
        const seen = new Set<string>()

        async function load() {
            const db = await LogDb.ainit()
            const iter = db.iterArchive()

            for await (const log of iter) {
                if (seen.has(log.id)) {
                    continue
                }

                seen.add(log.id)

                result.push(log)
                setLogs([...result])
            }

            setLoading(false)
            await sleep(refreshDelay)
            load()
        }

        load()

        return () => {}
    }, [])

    return { logs, loading }
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

interface UseSingleLogOptions {
    summary?: boolean
    indexMap?: boolean
    itemDrops?: boolean
    itemUsage?: boolean
    combatUsage?: boolean
}

// prettier-ignore
type UseSingleLogReturn<Opts extends UseSingleLogOptions> = {
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

export function useLog<T extends UseSingleLogOptions>(
    log: CompleteLog,
    opts: T
): UseSingleLogReturn<T> {
    const ctx = useLogContext()

    return {
        summary: opts.summary ? ctx.getSummary(log) : undefined,
        indexMap: opts.indexMap ? ctx.getIndexMap(log) : undefined,
        itemDrops: opts.itemDrops ? ctx.getItemDrops(log) : undefined,
        itemUsage: opts.itemUsage ? ctx.getItemUsage(log) : undefined,
        combatUsage: opts.combatUsage
            ? ctx.getCombatUsage(log)
            : undefined,
    } as UseSingleLogReturn<T>
}
