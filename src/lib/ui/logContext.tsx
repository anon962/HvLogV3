import { sleep } from "radash"
import { createContext, useContext, useEffect, useState } from "react"
import { CompleteLog } from "../logDb"
import { ContextProviderProps } from "../utils/typeUtils"
import { useAppContext } from "./appContext"

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
    const [logs, setLogs] = useState<CompleteLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const result: CompleteLog[] = []
        const seen = new Set<string>()

        async function load() {
            const iter = app.db.iterArchive()

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
