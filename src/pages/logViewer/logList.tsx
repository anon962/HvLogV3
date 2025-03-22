import { ArchivedLog } from "@/lib/db"
import { last, sleep } from "radash"
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
    const [logs, setLogs] = useState<ArchivedLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const result: ArchivedLog[] = []
        async function load() {
            const iter = await app.db.iterArchive()
            for await (const log of iter) {
                if (result.length && last(result)!.id >= log.id) {
                    continue
                }

                result.push(log)
                setLogs(result)
            }

            setLoading(false)
            await sleep(5000)
            load()
        }

        load()

        return () => {}
    }, [])

    return { logs, loading }
}
