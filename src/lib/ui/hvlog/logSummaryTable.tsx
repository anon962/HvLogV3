import { CompleteLog, LogDb, LogHash } from "@/lib/logDb"
import { LogAnalysis } from "@/lib/statsDb"
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
import { LogWithAnalysis } from "./main"

export function LogSummaryTable(props: {
    onClick?: (log: CompleteLog) => void

    activeLog: string
    logs: LogWithAnalysis[]
    loading: boolean
}) {
    const status = useBattleStatus()
    const now = useNow()

    let selectionIdx = props.logs.findIndex(
        ({ log }) => log.id === props.activeLog
    )
    selectionIdx = selectionIdx > -1 ? selectionIdx : 0

    const logEls = props.logs.map((log, idx) => {
        return (
            <LogRow
                now={now}
                {...log}
                idx={idx}
                selectionIdx={selectionIdx}
                onClick={props.onClick}
            />
        )
    })

    const headerSelected = selectionIdx === 0 ? " selected-next" : ""

    return (
        <div
            className="flex justify-center h-full"
            style={{ containerType: "inline-size" }}
        >
            <div className="log-table-container overflow-auto h-full pb-0!">
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
        </div>
    )
}

function LogRow(props: {
    log: CompleteLog
    analysis: LogAnalysis
    now: Date
    idx: number
    selectionIdx: number
    onClick?: (log: CompleteLog) => void
}) {
    const startDate = useDateFormatter(
        props.log.meta.start,
        props.now
    )

    const isSelected = props.idx === props.selectionIdx
    const isNextSelected = props.idx === props.selectionIdx - 1

    const duration = formatDuration(props.log)
    const typeSummary = formatBattleType(props.analysis)
    const turns = `${props.analysis.turnIndexes.length} turns`
    const { status, title: statusTitle } = formatCompletionType(
        props.analysis
    )

    // prettier-ignore
    const selectedClass = 
        isSelected ? " selected" :
        isNextSelected ? " selected-next" :
        ""

    return useMemo(
        () => (
            <TableRow
                className={"py-2" + selectedClass}
                data-id={props.log.id}
                onClick={() => props.onClick?.(props.log)}
            >
                <TableCell className="">{typeSummary}</TableCell>
                <TableCell className=" text-right">{turns}</TableCell>
                <TableCell className=" text-right">
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
        [
            props.log,
            props.analysis,
            startDate,
            props.idx,
            props.selectionIdx,
        ]
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

function formatBattleType(anal: LogAnalysis) {
    let className, label

    switch (anal.battleType?.name) {
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
            if (anal.round) {
                label = `Item World - ${anal.round.max}r`
            } else {
                label = `Item World`
            }
            break
        case "Arena":
            className = anal.battleType.id >= 100 ? "rob" : "arena"

            if (arenaAliases[anal.battleType.id]) {
                label = arenaAliases[anal.battleType.id]
            } else if (anal.round?.max === 1) {
                console.error(
                    `No alias for RoB #${anal.battleType.id}`,
                    anal
                )
                label = `RoB #${anal.battleType.id}`
            } else if (anal.round) {
                label = `Arena - ${anal.round.max}r`
            } else {
                console.error(
                    `No round date for arena #${anal.battleType.id}`
                )
                label = `Arena`
            }
            break
        default:
            className = ""
            label = "???"
            break
    }

    className = "type " + className
    return <span className={className}>{label}</span>
}

function formatCompletionType(anal: LogAnalysis) {
    let round, title
    if (anal.completionType !== "finish" && anal.round) {
        round = (
            <span>
                {anal.round.end} / {anal.round.max}
            </span>
        )

        if (anal.completionType === "die") {
            title = `Died on round ${anal.round.end} / ${anal.round.max}`
        } else if (anal.completionType === "flee") {
            title = `Flee on round ${anal.round.end} / ${anal.round.max}`
        }
    }

    let status
    switch (anal.completionType) {
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
