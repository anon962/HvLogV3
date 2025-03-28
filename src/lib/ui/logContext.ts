import { sleep } from "radash"
import { createContext, useContext, useEffect, useState } from "react"
import { CompleteLog, LogDb, LogId } from "../logDb"
import { LogSummary, SummaryDb } from "../summaryDb"
import { IndexMap } from "./hvlog/indexMap"

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

    const getIndexMap = useIndexMap(summaryDb)

    return { logs, logsLoading, getSummary, getIndexMap }
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

function useIndexMap(summaryDb: SummaryDb) {
    const cache = new Map<LogId, IndexMap>()

    const getIndexMap = (log: CompleteLog) => {
        if (!cache.has(log.id)) {
            const { roundIndexes, turnIndexes } = summaryDb.get(log)
            cache.set(
                log.id,
                new IndexMap(
                    turnIndexes,
                    roundIndexes,
                    log.entries.length
                )
            )
        }

        return cache.get(log.id)!
    }

    return getIndexMap
}

interface UseSingleLogOptions {
    summary?: boolean
    indexMap?: boolean
}

// prettier-ignore
type UseSingleLogReturn<Opts extends UseSingleLogOptions> = {
    [K in keyof Opts]:  
        K extends 'summary' ? Opts[K] extends true ?
            LogSummary : undefined :
        K extends 'indexMap' ? Opts[K] extends true ?
            IndexMap : undefined :
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
    } as UseSingleLogReturn<T>
}
