import { CompleteLog } from "@/lib/db"
import { sleep } from "radash"
import { useContext, useEffect, useState } from "react"
import { AppContext } from "./main"

const REFRESH_DELAY = 5000

export function LogList() {
    const { logs, loading } = useLogs()

    const logEls = logs.map((x) => {
        return <pre>{JSON.stringify(x.meta)}</pre>
    })

    return (
        <div>
            {logEls}
            {loading && <div>Loading...</div>}
        </div>
    )
}

export function useLogs() {
    const app = useContext(AppContext)
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
                } else {
                    seen.add(log.id)
                }

                result.push(log)
                setLogs([...result])
            }

            setLoading(false)
            await sleep(REFRESH_DELAY)
            load()
        }

        load()

        return () => {}
    }, [])

    return { logs, loading }
}
