import { isPromise, sleep } from "radash"
import { createContext, useContext, useEffect, useState } from "react"
import { CompleteLog, LogDb, LogId } from "../../logDb/logDb"
import { ContextProviderProps } from "../../utils/typeUtils"
import { useAppContext } from "../appContext"

export const ctx = createContext<ReturnType<typeof initContext>>(
    null as any
)

export function useLogContext() {
    return useContext(ctx)
}

export function LogContextProvider({
    children,
}: ContextProviderProps) {
    const value = initContext()

    return <ctx.Provider value={value}>{children}</ctx.Provider>
}

function initContext(refreshDelay = 5000) {
    const app = useAppContext()
    const [logIds, setLogIds] = useState<Set<LogId>>(new Set())

    const [cache, setCache] = useState({} as LogCache)

    useEffect(() => {
        async function load() {
            const update = new Set(await app.db.getLogIds())
            const diff = update.difference(logIds)
            if (!!diff.size) {
                setLogIds(logIds.union(diff))
            }

            await sleep(refreshDelay)
            load()
        }

        load()

        return () => {}
    }, [])

    return {
        logIds,
        useLogFetch: (ids: LogId[] = []) =>
            useLogFetch(ids, cache, setCache, app.db),
    }
}

function useLogFetch(
    logIds: LogId[],
    cache: LogCache,
    setCache: React.Dispatch<React.SetStateAction<LogCache>>,
    db: LogDb
) {
    const logs = logIds.map((id) =>
        cache[id] && !isPromise(cache[id]) ? cache[id] : null
    )

    useEffect(() => {
        async function load() {
            for (const id of logIds) {
                if (!(id in cache)) {
                    console.debug("Fetching log", id)
                    // Cache misses are sloooow >300ms
                    const promise = db.getLog(id).then(async (d) => {
                        setCache((cache) => ({
                            ...cache,
                            [id]: d,
                        }))
                    })
                    setCache((cache) => ({
                        ...cache,
                        [id]: promise,
                    }))
                }
            }
        }

        load()
    }, [logIds])

    return { logs }
}

type LogCache = Record<LogId, Promise<void> | CompleteLog>
