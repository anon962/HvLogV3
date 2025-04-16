import { LogId } from "@/lib/logDb/logDb"
import { LogSummary } from "@/lib/summaryDb"
import { enumerate, indexes } from "@/lib/utils/miscUtils"
import { cn } from "@/lib/utils/shadcnUtils"
import { alphabetical, sort, zip } from "radash"
import { ReactNode, useEffect, useState } from "react"
import { RunIcon, Skull2Icon } from "../../icons/misc"
import { CheckIcon } from "../../icons/tailwind"
import { useLogContext } from "../logContext"
import { useLogStatsContext, useStatsMaybe } from "../logStatsContext"

export interface LogSummaryColumn<TValue = any> {
    id: string
    align?: "text-left" | "text-right" | "text-center"
    header: {
        content: string
        className?: string
    }
    preprocess: (ids: LogId[]) => TValue[]
    // Should be pure, hooks go in preprocess
    cell: (opts: { logId: LogId; value: TValue }) => {
        content: ReactNode
        className?: string
        title?: string
    }
    sort?: (values: TValue[]) => number[]
}

const COLS = [
    {
        id: "type",
        header: { content: "Type", className: "w-[6rem]" },
        align: "text-left",
        preprocess: (ids) => preprocessBattleType(ids),
        cell: ({ value }) => value,
        sort: (values) =>
            alphabetical(
                indexes(values),
                (idx) => values[idx].content
            ),
    } as LogSummaryColumn<
        ReturnType<typeof preprocessBattleType>[number]
    >,
    {
        id: "turns",
        header: { content: "Turns" },
        align: "text-right",
        preprocess: (ids) => formatTurns(ids),
        cell: ({ value }) => value.cell,
        sort: (values) =>
            sort(indexes(values), (idx) => values[idx].sortValue),
    } as LogSummaryColumn<ReturnType<typeof formatTurns>[number]>,
    {
        id: "duration",
        header: { content: "Duration" },
        align: "text-right",
        preprocess: (ids) => formatDuration(ids),
        cell: ({ value }) => value.cell,
        sort: (values) =>
            sort(indexes(values), (idx) => values[idx].sortValue),
    } satisfies LogSummaryColumn<
        ReturnType<typeof formatDuration>[number]
    >,
    {
        id: "profit",
        header: { content: "Profit" },
        preprocess: (ids) => formatProfit(ids),
        cell: ({ value }) => value.cell,
        sort: (values) =>
            sort(indexes(values), (idx) => values[idx].sortValue),
    } satisfies LogSummaryColumn<
        ReturnType<typeof formatProfit>[number]
    >,
    {
        id: "date",
        header: { content: "Start Date" },
        preprocess: (ids) =>
            useSummaryMaybe(ids).map(
                (summary) => summary?.start ?? null
            ),
        cell: ({ value }) => formatStartDate(value),
        sort: (values) =>
            alphabetical(
                indexes(values),
                (idx) => values[idx] ?? "zzz"
            ),
    } satisfies LogSummaryColumn<string | null>,
    {
        id: "status",
        header: { content: "Status" },
        align: "text-center",
        preprocess: (ids) => formatCompletionType(ids),
        cell: ({ value }) => value.cell,
        sort: (values) =>
            alphabetical(
                indexes(values),
                (idx) => values[idx].sortValue
            ),
    } satisfies LogSummaryColumn<
        ReturnType<typeof formatCompletionType>[number]
    >,
    {
        id: "enchants",
        header: { content: "Enchants Unlocked", className: "pr-4" },
        align: "text-center",
        preprocess: (ids) => formatEnchants(ids),
        cell: ({ value }) => value.cell,
    } satisfies LogSummaryColumn<
        ReturnType<typeof formatEnchants>[number]
    >,
]

export const S_COLS = Object.fromEntries(
    COLS.map((c) => [c.id, c])
) as Record<(typeof COLS)[number]["id"], LogSummaryColumn>

export const ARENA_ALIASES = {
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

function preprocessBattleType(ids: LogId[]) {
    const { stats } = useStatsMaybe(ids, {
        summary: true,
    })

    const result = []

    for (const s of stats) {
        let content
        let className = ["type"]

        const { summary } = s ?? {}

        if (!summary) {
            content = "-"
        } else {
            const result = preprocessBattleTypeSingle(summary)
            content = result.content
            className.push(...result.className)
        }

        result.push({ className: className.join(" "), content })
    }

    return result
}

export function preprocessBattleTypeSingle(summary: LogSummary) {
    let content
    let className = []

    switch (summary.battleType?.name) {
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

            if (ARENA_ALIASES[summary.battleType.id]) {
                content = ARENA_ALIASES[summary.battleType.id]
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

    return { content, className }
}

function formatTurns(ids: LogId[]) {
    const { stats } = useStatsMaybe(ids, {
        summary: true,
    })

    const result = []

    for (const s of stats) {
        const { summary } = s ?? {}

        let content, sortValue
        if (summary) {
            content = `${summary.numTurns} turns`
            sortValue = summary.numTurns
        } else {
            content = "-"
            sortValue = Number.POSITIVE_INFINITY
        }

        result.push({
            cell: {
                content,
            },
            sortValue,
        })
    }

    return result
}

function formatDuration(ids: LogId[]) {
    const summaries = useSummaryMaybe(ids)

    const result = []

    for (const summary of summaries) {
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

        result.push({
            cell: {
                content,
            },
            sortValue: elapsed,
        })
    }

    return result
}

function formatProfit(ids: LogId[]) {
    const { stats } = useStatsMaybe(ids, {
        finances: true,
        summary: true,
    })

    const result = []

    for (const s of stats) {
        const { finances, summary } = s ?? {}

        let profit, className, content
        if (finances && summary) {
            ;({ profit } = finances)

            className = cn(
                "profit text-right",
                // prettier-ignore
                profit > 10_000 ? "positive" :
        profit < -10_000 ? "negative" :
        ""
            )

            content = `${(profit / 1000).toFixed(0)}k`
            // content = `${Math.round(
            //     profit / summary.numTurns
            // )}c / turn`
        } else {
            content = "-"
            profit = Number.NEGATIVE_INFINITY
        }

        result.push({
            cell: {
                className,
                content,
            },
            sortValue: profit,
        })
    }

    return result
}

function formatStartDate(
    start: string | null,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {}
) {
    const [result, setResult] = useState<{
        content: string
        title?: string
    }>({
        content: "-",
    })

    useEffect(() => {
        function load() {
            if (!start) {
                return
            }

            const now = new Date()

            const d = new Date(start)

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
                        `${d.getHours().toString().padStart(2, "0")}`,
                        `${d
                            .getMinutes()
                            .toString()
                            .padStart(2, "0")}`,
                    ].join(":") +
                    " " +
                    [
                        `${d.getDate().toString().padStart(2, "0")}`,
                        `${(d.getMonth() + 1)
                            .toString()
                            .padStart(2, "0")}`,
                        `${d.getFullYear()}`,
                    ].join("-")
            }

            setResult({
                content,
                title: start,
            })
        }

        load()
        const timerId = setInterval(() => load(), 3000)
        return () => clearInterval(timerId)
    }, [start])

    return result
}

function formatCompletionType(ids: LogId[]) {
    const summaries = useSummaryMaybe(ids)

    const result = []

    for (const summary of summaries) {
        let status, title, sortValue
        if (summary) {
            let round
            if (
                summary.completionType !== "finish" &&
                summary.round
            ) {
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

        result.push({
            cell: {
                content: status,
                title,
            },
            sortValue,
        })
    }

    return result
}

function formatEnchants(ids: LogId[]) {
    const summaries = useSummaryMaybe(ids)

    return summaries.map((s) => {
        let content, sortValue

        if (s) {
            content = s.enchants
                .map((text, idx) => {
                    text = text.replace("Level ", "")

                    const isLast = idx === s.enchants.length - 1
                    if (!isLast) {
                        const isEven = idx % 2 === 0
                        text += isEven ? ", " : ",\n"
                    }

                    return text
                })
                .join("")
            sortValue = content
        } else {
            content = ""
            sortValue = ""
        }

        return {
            cell: {
                content,
                className: "max-w-60 text-wrap whitespace-pre",
            },
            sortValue,
        }
    })
}
function useSummaryMaybe(ids: LogId[]) {
    const { stats } = useStatsMaybe(ids, {
        summary: true,
    })

    const { useLogFetch } = useLogContext()
    const { getSummary } = useLogStatsContext()

    const toFetchIdxs: number[] = []
    const result = []
    for (const [idx, s] of enumerate(stats)) {
        result.push(s ? s.summary : null)

        if (!s) {
            toFetchIdxs.push(idx)
        }
    }

    const fetcher = useLogFetch(toFetchIdxs.map((idx) => ids[idx]))
    for (const [idx, log] of zip(toFetchIdxs, fetcher.logs)) {
        if (log) {
            result[idx] = getSummary(log)
        }
    }

    return result
}
