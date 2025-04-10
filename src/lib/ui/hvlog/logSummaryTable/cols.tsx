import { LogId } from "@/lib/logDb"
import { cn } from "@/lib/utils/shadcnUtils"
import { alphabetical, sort } from "radash"
import { ReactNode, useEffect, useState } from "react"
import { RunIcon, Skull2Icon } from "../../icons/misc"
import { CheckIcon } from "../../icons/tailwind"
import { useLogContext } from "../logContext"
import { useLogStatsContext, useStatsMaybe } from "../logStatsContext"

export interface LogSummaryColumn<TValue = any> {
    align?: "text-left" | "text-right" | "text-center"

    header: {
        content: string
        className?: string
    }

    preprocess: (opts: { logId: LogId }) => TValue

    cell: (opts: { logId: LogId; value: TValue }) => {
        content: ReactNode
        className?: string
        title?: string
    }

    sortBy?: (values: TValue[]) => TValue[]
}

const COLS = {
    type: {
        header: { content: "Type", className: "w-[6rem]" },
        align: "text-left",
        preprocess: ({ logId }) => formatBattleType(logId),
        cell: ({ value }) => value,
        sortBy: (values) => alphabetical(values, (v) => v.content),
    } as LogSummaryColumn<ReturnType<typeof formatBattleType>>,
    turns: {
        header: { content: "Turns" },
        preprocess: ({ logId }) => formatTurns(logId),
        cell: ({ value }) => value.cell,
        sortBy: (values) => sort(values, (v) => v.sortValue),
    } as LogSummaryColumn<ReturnType<typeof formatTurns>>,
    duration: {
        header: { content: "Duration" },
        preprocess: ({ logId }) => formatDuration(logId),
        cell: ({ value }) => value.cell,
        sortBy: (values) => sort(values, (v) => v.sortValue),
    } satisfies LogSummaryColumn<ReturnType<typeof formatDuration>>,
    profit: {
        header: { content: "Profit" },
        preprocess: ({ logId }) => formatProfit(logId),
        cell: ({ value }) => value.cell,
        sortBy: (values) => sort(values, (v) => v.sortValue),
    } satisfies LogSummaryColumn<ReturnType<typeof formatProfit>>,
    date: {
        header: { content: "Start Date" },
        preprocess: ({ logId }) => formatStartDate(logId),
        cell: ({ value }) => value,
        sortBy: (values) => alphabetical(values, (v) => v.content),
    } satisfies LogSummaryColumn<ReturnType<typeof formatStartDate>>,
    status: {
        header: { content: "Status" },
        align: "text-center",
        preprocess: ({ logId }) => formatCompletionType(logId),
        cell: ({ value }) => value.cell,
        sortBy: (values) => alphabetical(values, (v) => v.sortValue),
    } satisfies LogSummaryColumn<
        ReturnType<typeof formatCompletionType>
    >,
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

    let content, sortValue
    if (indexMap) {
        content = `${indexMap.turnIndexes.length} turns`
        sortValue = indexMap.turnIndexes.length
    } else {
        content = "-"
        sortValue = Number.POSITIVE_INFINITY
    }

    return {
        cell: {
            content,
        },
        sortValue,
    }
}

function formatDuration(logId: string) {
    const summary = useSummaryMaybe(logId)

    let elapsed, content
    if (summary) {
        const end = new Date(summary.lastUpdate)
        const start = new Date(summary.start)

        elapsed = end.getTime() - start.getTime()
        const seconds = elapsed / 1000

        const ss = Math.trunc(seconds % 60)
            .toString()
            .padStart(2, "0")
        const mm = Math.trunc(seconds / 60).toString()

        const mmClassName = seconds < 60 ? "mm" : ""

        content = (
            <span>
                <span className={mmClassName}>{mm}m </span>
                <span>{ss}s</span>
            </span>
        )
    } else {
        content = "-"
        elapsed = Number.POSITIVE_INFINITY
    }

    return {
        cell: {
            content,
        },
        sortValue: elapsed,
    }
}

function formatProfit(logId: LogId) {
    const { finances } = useStatsMaybe(logId, {
        finances: true,
    })

    let profit, className, content
    if (finances) {
        ;({ profit } = finances)

        className = cn(
            "profit text-right",
            // prettier-ignore
            profit > 10_000 ? "positive" :
        profit < -10_000 ? "negative" :
        ""
        )

        content = `${(profit / 1000).toFixed(0)}k`
    } else {
        content = "-"
        profit = Number.NEGATIVE_INFINITY
    }

    return {
        cell: {
            className,
            content,
        },
        sortValue: profit,
    }
}

function formatStartDate(
    logId: string,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {}
) {
    const summary = useSummaryMaybe(logId)

    const [result, setResult] = useState<{
        content: string
        title?: string
    }>({
        content: "-",
    })

    useEffect(() => {
        function load() {
            if (!summary) {
                return
            }

            const now = new Date()

            const d = new Date(summary.start)

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
                title: summary.start,
            })
        }

        load()
        const timerId = setInterval(() => load(), 3000)
        return () => clearInterval(timerId)
    }, [summary?.start])

    return result
}

function formatCompletionType(logId: LogId) {
    const summary = useSummaryMaybe(logId)

    let status, title, sortValue
    if (summary) {
        let round
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

        switch (summary.completionType) {
            case "finish":
                status = (
                    <span className="finish flex justify-center">
                        <CheckIcon className="flex" />
                    </span>
                )
                sortValue = "9_done"
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
                sortValue = "1_die"
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
                sortValue = "2_flee"
                break
            default:
                status = (
                    <span className="flex justify-center gap-1">
                        <span className="">???</span>

                        {round}
                    </span>
                )
                sortValue = "3_unknown"
                break
        }
    } else {
        status = "-"
        sortValue = "9_done"
    }

    return {
        cell: {
            content: status,
            title,
        },
        sortValue,
    }
}

function useSummaryMaybe(logId: LogId) {
    let { summary } = useStatsMaybe(logId, {
        summary: true,
    })

    const { useLogFetch } = useLogContext()
    const { log } = useLogFetch(summary ? null : logId)

    const { getSummary } = useLogStatsContext()
    if (!summary && log) {
        summary = getSummary(log)
    }

    return summary
}
