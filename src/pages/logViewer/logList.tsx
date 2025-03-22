import { CompleteLog, LogDb, LogHash } from "@/lib/db"
import { sleep } from "radash"
import { useEffect, useState } from "react"

export function LogList() {
    const { logs, loading } = useLogs()
    const status = useBattleStatus()

    const logEls = logs.map((x) => {
        return <pre>{JSON.stringify(x.meta)}</pre>
    })

    return (
        <div>
            {logEls}
            {loading ? (
                <div>Loading...</div>
            ) : status ? (
                <div>
                    In battle ({status.battleType}{" "}
                    {status.currentRound} / {status.maxRound})...
                </div>
            ) : null}
        </div>
    )
}

export function useLogs(refreshDelay = 5000) {
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
                } else {
                    seen.add(log.id)
                }

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

export function useBattleStatus(refreshDelay = 100) {
    const [status, setStatus] = useState<LogHash | null>(null)

    useEffect(() => {
        async function load() {
            const db = await LogDb.ainit()
            const hash = await db.getLogHash()
            if (hash.battleType !== "") {
                setStatus(hash)
            } else {
                setStatus(null)
            }

            await sleep(refreshDelay)
            load()
        }

        load()

        return () => {}
    }, [])

    return status
}
