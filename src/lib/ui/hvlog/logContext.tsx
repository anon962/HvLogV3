import { isPromise, sleep } from "radash"
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { CompleteLog, LogDb, LogId } from "../../logDb/logDb"
import { ContextProviderProps } from "../../utils/typeUtils"
import { useDbContext } from "../dbContext"

export const ctx = createContext<ReturnType<typeof initContext>>(
    null as any
)

export function useLogContext() {
    return useContext(ctx)
}

export function LogContextProvider({
    children,
    bothDbs,
}: ContextProviderProps & { bothDbs?: boolean }) {
    const value = initContext(bothDbs)

    return <ctx.Provider value={value}>{children}</ctx.Provider>
}

function initContext(bothDbs = false, refreshDelay = 5000) {
    const [logIds, setLogIds] = useState<
        Set<{ type: "persistent" | "isekai"; id: LogId }>
    >(new Set())

    const { activeDb, activeType, persistentDb, isekaiDb } =
        useDbContext()

    const [cache, setCache] = useState({} as LogCache)

    const seen = useRef({
        persistent: new Set<string>(),
        isekai: new Set<string>(),
    })

    useEffect(() => {
        async function load() {
            const update = []

            if (bothDbs) {
                update.push(
                    ...(await persistentDb.getLogIds()).map((id) => ({
                        type: "persistent" as const,
                        id,
                    }))
                )
                update.push(
                    ...(await isekaiDb.getLogIds()).map((id) => ({
                        type: "isekai" as const,
                        id,
                    }))
                )
            } else {
                update.push(
                    ...(await activeDb.getLogIds()).map((id) => ({
                        type: activeType,
                        id,
                    }))
                )
            }

            const newEntries = update.filter((x) =>
                x.type === "persistent"
                    ? !seen.current.persistent.has(x.id)
                    : !seen.current.isekai.has(x.id)
            )
            if (!!newEntries.length) {
                setLogIds(logIds.union(new Set(newEntries)))

                for (const { type, id } of newEntries) {
                    seen.current[type].add(id)
                }
            }

            await sleep(refreshDelay)
            load()
        }

        load()

        return () => {}
    }, [])

    return {
        logIds,
        useLogFetch: (ids: LogId[] = []) => {
            const toFetch = ids.map((id) => {
                if (seen.current.persistent.has(id)) {
                    return { type: "persistent" as const, id }
                } else if (seen.current.isekai.has(id)) {
                    return { type: "isekai" as const, id }
                } else {
                    return { type: null, id }
                }
            })
            return useLogFetch(
                toFetch,
                cache,
                setCache,
                persistentDb,
                isekaiDb
            )
        },
        getLogType: (id: LogId) => {
            return seen.current.persistent.has(id)
                ? ("persistent" as const)
                : ("isekai" as const)
        },
        isFetching: (id: LogId) => isPromise(cache[id]),
    }
}

function useLogFetch(
    toFetch: Array<{
        type: "persistent" | "isekai" | null
        id: string
    }>,
    cache: LogCache,
    setCache: React.Dispatch<React.SetStateAction<LogCache>>,
    persistentDb: LogDb,
    isekaiDb: LogDb
) {
    const logs = toFetch.map(({ id }) =>
        cache[id] && !isPromise(cache[id]) ? cache[id] : null
    )

    useEffect(() => {
        async function load() {
            for (const { type, id } of toFetch) {
                if (!(id in cache) && type) {
                    const db =
                        type === "persistent"
                            ? persistentDb
                            : isekaiDb

                    console.debug(`Fetching ${type} log`, id)

                    // IndexedDb is sloooow >300ms
                    const promise = db.getLog(id).then(async (d) => {
                        if (d) {
                            setCache((cache) => ({
                                ...cache,
                                [id]: d,
                            }))
                        } else {
                            console.warn(
                                `Fetch for ${type} log failed`,
                                id
                            )

                            setCache((cache) => {
                                const update = { ...cache }
                                delete update[id]
                                return update
                            })
                        }
                    })
                    setCache((cache) => ({
                        ...cache,
                        [id]: promise,
                    }))
                }
            }
        }

        load()
    }, [toFetch])

    return { logs }
}

type LogCache = Record<LogId, Promise<void> | CompleteLog>
