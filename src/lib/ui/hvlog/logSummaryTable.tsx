import { CompleteLog, LogDb, LogHash } from "@/lib/logDb"
import { RunIcon, Skull2Icon } from "@/lib/ui/icons/misc"
import { Check, EyeIcon } from "@/lib/ui/icons/tailwind"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/lib/ui/shadcn/table"
import { sleep } from "radash"
import { useEffect, useMemo, useState } from "react"
import { useStats } from "./logStatsContext"

export function LogSummaryTable(props: {
    onClick?: (log: CompleteLog) => void

    selectionIdx: number
    logs: CompleteLog[]
    loading: boolean
}) {
    const status = useBattleStatus()
    const now = useNow()

    const logEls = props.logs.map((log, idx) => {
        return (
            <LogRow
                key={log.id}
                log={log}
                now={now}
                {...log}
                idx={idx}
                selectionIdx={props.selectionIdx}
                onClick={props.onClick}
            />
        )
    })

    const headerSelected =
        props.selectionIdx === 0 ? " selected-next" : ""

    return (
        <div className="log-table-container overflow-auto pb-0!">
            <Table className="log-table w-auto min-h-0 mb-8">
                <TableHeader>
                    <TableRow className={"" + headerSelected}>
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
                        <TableHead className="text-center">
                            Status
                        </TableHead>
                        {/* <TableHead className="">View</TableHead> */}
                    </TableRow>
                </TableHeader>
                <TableBody>{logEls}</TableBody>
            </Table>
            {/* {props.loading ? (
                    <div>Loading...</div>
                ) : status ? (
                    <div>
                        In battle ({status.battleType}{" "}
                        {status.currentRound} / {status.maxRound})...
                    </div>
                ) : null} */}
        </div>
    )
}

function LogRow(props: {
    log: CompleteLog
    now: Date
    idx: number
    selectionIdx: number
    onClick?: (log: CompleteLog) => void
}) {
    const { indexMap } = useStats(props.log, {
        indexMap: true,
    })

    const startDate = useDateFormatter(
        props.log.meta.start,
        props.now
    )

    const isSelected = props.idx === props.selectionIdx
    const isNextSelected = props.idx === props.selectionIdx - 1

    const duration = formatDuration(props.log)
    const typeSummary = formatBattleType(props.log)
    const turns = `${indexMap.turnIndexes.length} turns`
    const { status, title: statusTitle } = formatCompletionType(
        props.log
    )

    // prettier-ignore
    const selectedClass = 
        isSelected ? " selected" :
        isNextSelected ? " selected-next" :
        ""

    return useMemo(
        () => (
            <TableRow
                key={props.log.id}
                className={"py-2" + selectedClass}
                data-id={props.log.id}
                onClick={() => props.onClick?.(props.log)}
            >
                <TableCell className="">{typeSummary}</TableCell>
                <TableCell className="text-right">{turns}</TableCell>
                <TableCell className="text-right">
                    {duration}
                </TableCell>
                <TableCell className="" title={props.log.meta.start}>
                    {startDate}
                </TableCell>
                <TableCell className="status" title={statusTitle}>
                    {status}
                </TableCell>
                {/* <TableCell className="flex justify-center">
                    <ViewButton isSelected={isSelected} />
                </TableCell> */}
            </TableRow>
        ),
        [props.log, startDate, props.idx, props.selectionIdx]
    )
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

    const mmClassName = seconds < 60 ? "mm" : ""

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

function formatBattleType(log: CompleteLog) {
    const { summary } = useStats(log, {
        summary: true,
    })

    let className, label

    switch (summary.battleType?.name) {
        case "Grindfest":
            className = "gf"
            label = "Grindfest"
            break
        case "random encounter":
            className = "re"
            label = "Random Encounter"
            break
        case "Item World":
            className = "iw"
            if (summary.round) {
                label = `Item World - ${summary.round.max}r`
            } else {
                label = `Item World`
            }
            break
        case "Arena":
            className = summary.battleType.id >= 100 ? "rob" : "arena"

            if (arenaAliases[summary.battleType.id]) {
                label = arenaAliases[summary.battleType.id]
            } else if (summary.round?.max === 1) {
                console.error(
                    `No alias for RoB #${summary.battleType.id}`,
                    summary
                )
                label = `RoB #${summary.battleType.id}`
            } else if (summary.round) {
                label = `Arena - ${summary.round.max}r`
            } else {
                console.error(
                    `No round date for arena #${summary.battleType.id}`
                )
                label = `Arena`
            }
            break
        case "Tower":
            className = "tower"
            label = `Tower - Floor ${summary.battleType.floor}`
            break
        default:
            className = ""
            label = "???"
            break
    }

    className = "type " + className
    return <span className={className}>{label}</span>
}

function formatCompletionType(log: CompleteLog) {
    const { summary } = useStats(log, {
        summary: true,
    })

    let round, title
    if (summary.completionType !== "finish" && summary.round) {
        round = (
            <span>
                {summary.round.end} / {summary.round.max}
            </span>
        )

        if (summary.completionType === "die") {
            title = `Died on round ${summary.round.end} / ${summary.round.max}`
        } else if (summary.completionType === "flee") {
            title = `Flee on round ${summary.round.end} / ${summary.round.max}`
        }
    }

    let status
    switch (summary.completionType) {
        case "finish":
            status = (
                <span className="finish flex justify-center">
                    <Check className="flex" />
                </span>
            )
            break
        case "die":
            status = (
                <span className="die flex justify-center gap-1">
                    <span className="w-5">
                        <Skull2Icon />
                    </span>

                    {round}
                </span>
            )
            break
        case "flee":
            status = (
                <span className="flee flex justify-center gap-1">
                    <span className="w-6">
                        <RunIcon />
                    </span>

                    {round}
                </span>
            )
            break
        default:
            status = (
                <span className="flex justify-center gap-1">
                    <span className="">???</span>

                    {round}
                </span>
            )
            break
    }

    return { status, title }
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

function ViewButton(props: { isSelected: boolean }) {
    return (
        <span>
            <EyeIcon className="view" />
        </span>
    )
}
