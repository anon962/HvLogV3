import { LogId } from "@/lib/logDb"
import { cn } from "@/lib/utils/shadcnUtils"
import { ReactNode, useEffect, useState } from "react"
import { RunIcon, Skull2Icon } from "../../icons/misc"
import { CheckIcon } from "../../icons/tailwind"
import { useLogContext } from "../logContext"
import { useStatsMaybe } from "../logStatsContext"

export interface LogSummaryColumn {
    align?: "text-left" | "text-right" | "text-center"

    header: {
        content: string
        className?: string
    }

    cell: (opts: { logId: LogId }) => {
        content: ReactNode
        className?: string
        title?: string
    }
}

const COLS = {
    type: {
        header: { content: "Type", className: "w-[6rem]" },
        align: "text-left",
        cell: ({ logId }) => ({
            ...formatBattleType(logId),
        }),
    } as LogSummaryColumn,
    turns: {
        header: { content: "Turns" },
        cell: ({ logId }) => ({
            content: formatTurns(logId),
        }),
    } as LogSummaryColumn,
    duration: {
        header: { content: "Duration" },
        cell: ({ logId }) => ({
            content: formatDuration(logId),
        }),
    } as LogSummaryColumn,
    profit: {
        header: { content: "Profit" },
        cell: ({ logId }) => ({
            ...formatProfit(logId),
        }),
    } as LogSummaryColumn,
    date: {
        header: { content: "Start Date" },
        cell: ({ logId }) => ({
            ...formatStartDate(logId),
        }),
    } as LogSummaryColumn,
    status: {
        header: { content: "Status" },
        align: "text-center",
        cell: ({ logId }) => ({
            ...formatCompletionType(logId),
        }),
    } as LogSummaryColumn,
} as const

export const S_COLS = COLS as Record<
    keyof typeof COLS,
    LogSummaryColumn
>

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

function formatBattleType(logId: LogId) {
    const { summary } = useStatsMaybe(logId, {
        summary: true,
    })

    let content
    let className = ["type"]

    switch (summary?.battleType?.name) {
        case undefined:
            content = "-"
            break
        case "Grindfest":
            className.push("gf")
            content = "Grindfest"
            break
        case "random encounter":
            className.push("re")
            content = "Random Encounter"
            break
        case "Item World":
            className.push("iw")
            if (summary.round) {
                content = `Item World - ${summary.round.max}r`
            } else {
                content = `Item World`
            }
            break
        case "Arena":
            className.push(
                summary.battleType.id >= 100 ? "rob" : "arena"
            )

            if (arenaAliases[summary.battleType.id]) {
                content = arenaAliases[summary.battleType.id]
            } else if (summary.round?.max === 1) {
                console.error(
                    `No alias for RoB #${summary.battleType.id}`,
                    summary
                )
                content = `RoB #${summary.battleType.id}`
            } else if (summary.round) {
                content = `Arena - ${summary.round.max}r`
            } else {
                console.error(
                    `No round date for arena #${summary.battleType.id}`
                )
                content = `Arena`
            }
            break
        case "Tower":
            className.push("tower")
            content = `Tower - Floor ${summary.battleType.floor}`
            break
        default:
            className.push("")
            content = "???"
            break
    }

    return { className: className.join(" "), content }
}

function formatTurns(logId: LogId) {
    const { indexMap } = useStatsMaybe(logId, {
        indexMap: true,
    })

    if (indexMap) {
        return `${indexMap.turnIndexes.length} turns`
    } else {
        return "-"
    }
}

function formatDuration(logId: string) {
    const { useLogFetch } = useLogContext()
    const { log } = useLogFetch(logId)
    if (!log) {
        return "-"
    }

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

function formatProfit(logId: LogId) {
    const { finances } = useStatsMaybe(logId, {
        finances: true,
    })

    if (!finances) {
        return { content: "-" }
    }

    const { profit } = finances

    const className = cn(
        "profit text-right",
        // prettier-ignore
        profit > 10_000 ? "positive" :
        profit < -10_000 ? "negative" :
        ""
    )

    const content = `${(profit / 1000).toFixed(0)}k`

    return { className, content }
}

function formatStartDate(
    logId: string,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {}
) {
    const { useLogFetch } = useLogContext()
    const { log } = useLogFetch(logId)

    const [result, setResult] = useState<
        ReturnType<LogSummaryColumn["cell"]>
    >({
        content: "-",
    })

    useEffect(() => {
        function load() {
            if (!log) {
                return
            }

            const now = new Date()

            const d = new Date(log.meta.start)

            const elapsed = now.getTime() - d.getTime()

            const seconds = elapsed / 1_000
            const minutes = seconds / 60
            const hours = seconds / 3600

            let content: string
            if (minutes <= (opts.threshMinutes ?? 120)) {
                content = `${Math.trunc(minutes)} minutes ago`
            } else if (hours <= (opts.threshHours ?? 48)) {
                content = `${Math.trunc(hours)} hours ago`
            } else {
                content =
                    [
                        `${d.getDate().toString().padStart(2, "0")}`,
                        `${d.getMonth().toString().padStart(2, "0")}`,
                        `${d.getFullYear()}`,
                    ].join("-") +
                    " " +
                    [
                        `${d.getHours().toString().padStart(2, "0")}`,
                        `${d
                            .getMinutes()
                            .toString()
                            .padStart(2, "0")}`,
                    ].join(":")
            }

            setResult({
                content,
                title: log.meta.start,
            })
        }

        const timerId = setInterval(() => load(), 3000)
        return () => clearInterval(timerId)
    }, [log])

    return result
}

function formatCompletionType(logId: LogId) {
    const { summary } = useStatsMaybe(logId, {
        summary: true,
    })

    if (!summary) {
        return { content: "-" }
    }

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
                    <CheckIcon className="flex" />
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

    return { content: status, title }
}
