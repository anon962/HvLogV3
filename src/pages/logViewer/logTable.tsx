import { CompleteLog, LogDb, LogHash } from "@/lib/logDb"
import { LogAnalysis, LogStats } from "@/lib/statsDb"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { alphabetical, sleep } from "radash"
import { useEffect, useMemo, useState } from "react"

export function LogTable() {
    let { logs, loading } = useLogs()
    const status = useBattleStatus()
    const now = useNow()

    logs = alphabetical(logs, (l) => l.log.meta.start, "desc")

    const logEls = logs.map((x) => {
        return <LogRow now={now} {...x} />
    })

    return (
        <div>
            <Table className="w-auto">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">
                            Type
                        </TableHead>
                        <TableHead className="text-right">
                            Turns
                        </TableHead>
                        <TableHead className="text-right">
                            Duration
                        </TableHead>
                        <TableHead className="">Date</TableHead>
                        <TableHead className="">Status</TableHead>
                        <TableHead className=""></TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>{logEls}</TableBody>
            </Table>

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

function LogRow(props: {
    log: CompleteLog
    analysis: LogAnalysis
    now: Date
}) {
    const startDate = useDateFormatter(
        props.log.meta.start,
        props.now
    )
    const duration = formatDuration(props.log)
    const typeSummary = formatBattleType(props.analysis)
    const turns = `${props.analysis.turnIndexes.length} turns`
    const completionType = formatCompletionType(props.analysis)

    return useMemo(
        () => (
            <TableRow className="py-2" data-id={props.log.id}>
                <TableCell className="px-4">{typeSummary}</TableCell>
                <TableCell className="px-4 text-right">
                    {turns}
                </TableCell>
                <TableCell className="px-4 text-right">
                    {duration}
                </TableCell>
                <TableCell
                    className="px-4"
                    title={props.log.meta.start}
                >
                    {startDate}
                </TableCell>
                <TableCell className="px-4">
                    {completionType}
                </TableCell>
            </TableRow>
        ),
        [props.log, props.analysis, startDate]
    )
}

export function useLogs(refreshDelay = 5000) {
    const [completeLogs, setCompleteLogs] = useState<CompleteLog[]>(
        []
    )
    const [loading, setLoading] = useState(true)

    const stats = new LogStats()
    const logs = useMemo(
        () =>
            completeLogs.map((log) => ({
                log,
                analysis: stats.get(log.id) ?? stats.analyze(log),
            })),
        [completeLogs]
    )

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
                setCompleteLogs([...result])
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

function useDateFormatter(
    isoDate: string,
    now: Date,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {}
) {
    const d = new Date(isoDate)

    const elapsed = now.getTime() - d.getTime()
    const seconds = elapsed / 1_000

    const minutes = seconds / 60
    if (minutes <= (opts.threshMinutes ?? 120)) {
        return `${Math.trunc(minutes)} minutes ago`
    }

    const hours = seconds / 3600
    if (hours <= (opts.threshHours ?? 48)) {
        return `${Math.trunc(hours)} hours ago`
    }

    // const days = elapsed / 86400
    // if (days <= (opts.threshDays ?? 14)) {
    //     return `${Math.trunc(days)} days ago`
    // }

    const dateStr =
        [
            `${d.getDate().toString().padStart(2, "0")}`,
            `${d.getMonth().toString().padStart(2, "0")}`,
            `${d.getFullYear()}`,
        ].join("-") +
        " " +
        [
            `${d.getHours().toString().padStart(2, "0")}`,
            `${d.getMinutes().toString().padStart(2, "0")}`,
        ].join(":")

    return dateStr
}

function formatDuration(log: CompleteLog) {
    const end = new Date(log.meta.lastUpdate)
    const start = new Date(log.meta.start)

    const elapsed = end.getTime() - start.getTime()
    const seconds = elapsed / 1000

    const ss = Math.trunc(seconds % 60)
        .toString()
        .padStart(2, "0")
    const mm = Math.trunc(seconds / 60).toString()

    const mmClassName = seconds < 60 ? "text-muted-foreground" : ""

    return (
        <span>
            <span className={mmClassName}>{mm}m </span>
            <span>{ss}s</span>
        </span>
    )
}

// function formatDuration(log: CompleteLog) {
//     const end = new Date(log.meta.lastUpdate)
//     const start = new Date(log.meta.start)

//     const elapsed = end.getTime() - start.getTime()
//     const seconds = elapsed / 1000

//     if (seconds < 60) {
//         return `${Math.round(seconds)} s`
//     } else {
//         const minutes = seconds / 60
//         return `${Math.round(minutes)} m`
//     }
// }

const arenaAliases = {
    33: "Arena - DwD",
    34: "Arena - PGC",
    35: "Arena - SPL",
    105: "RoB - Konata",
    106: "RoB - Asahina",
    107: "RoB - Asakura",
    108: "RoB - Nagato",
    109: "RoB - Real Life",
    110: "RoB - Unicorn",
    111: "RoB - FSM",
    112: "RoB - TTT",
} as Record<number, string>

function formatBattleType(anal: LogAnalysis) {
    switch (anal.battleType?.name) {
        case "Grindfest":
            return "Grindfest"
        case "random encounter":
            return "Random Encounter"
        case "Item World":
            if (anal.round) {
                return `Item World - ${anal.round.max}r`
            } else {
                return `Item World`
            }
        case "Arena":
            if (arenaAliases[anal.battleType.id]) {
                return arenaAliases[anal.battleType.id]
            } else if (anal.round?.max === 1) {
                console.error(
                    `No alias for RoB #${anal.battleType.id}`,
                    anal
                )
                return `RoB #${anal.battleType.id}`
            } else if (anal.round) {
                return `Arena - ${anal.round.max}r`
            } else {
                console.error(
                    `No round date for arena #${anal.battleType.id}`
                )
                return `Arena`
            }
        default:
            return "???"
    }
}

function formatCompletionType(anal: LogAnalysis) {
    switch (anal.completionType) {
        case "finish":
            return "@todo checkmark"
        case "die":
            return "@todo tombstone"
        case "flee":
            return "@todo run"
        default:
            return "???"
    }
}

// function formatErrors(anal: LogAnalysis) {
//     const errorStrings = Object.entries(anal.errors).flatMap(
//         ([key, val]) => {
//             if (!val) {
//                 return []
//             }

//             switch(key as keyof LogAnalysis['errors']) {
//                 case "inconsistentBattleTypes":
//                     return ["Mixed battle types"]
//             }
//         }
//     )
// }

function useNow(refreshDelay = 3000) {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date())
        }, refreshDelay)

        return () => {
            clearInterval(timer)
        }
    }, [])

    return now
}
