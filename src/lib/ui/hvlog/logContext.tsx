import { sleep } from "radash"
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { CompleteLog, LogDb, LogId } from "../../logDb"
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

    const cache = useRef<Record<LogId, Promise<CompleteLog>>>({})

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
        useLogFetch: (id: LogId | null = null) =>
            useLogFetch(id, cache.current, app.db),
    }
}

function useLogFetch(
    id: LogId | null,
    cache: Record<LogId, Promise<CompleteLog>>,
    db: LogDb
) {
    const [logId, setLogId] = useState(id)
    const [log, setLog] = useState<CompleteLog | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        setLoading(true)
        let isCancelled = false

        async function load() {
            if (logId === null) {
                setLoading(true)
                return
            }

            if (!(logId in cache)) {
                cache[logId] = db.get("complete", logId)
            }

            const data = await cache[logId]

            if (isCancelled) {
                return
            }

            setLog(data)
        }

        load().then(() => {
            setLoading(false)
        })

        return () => {
            isCancelled = true
        }
    }, [logId])

    return { log, logId, setLogId, loading }
}
