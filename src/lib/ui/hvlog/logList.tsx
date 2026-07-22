import { LOG_SOURCE, LogSearchResult } from "@/lib/ui/hvlog/logSource"
import { humanizeBattleType } from "@/lib/stats/metaStats"
import { formatNumber, useAsync } from "@/lib/utils/miscUtils"
import { useEffect, useState } from "react"
import { RunIcon, Skull2Icon } from "../icons/misc"
import { CheckIcon } from "../icons/tailwind"
import { ListTable } from "../listTable"
import { cn } from "myutils"

export function LogList() {
    const logSource = LOG_SOURCE.useContext()
    const fetcher = useAsync(
        async (req) => {
            // @fixme: temp client response
            // @fixme: prefetch
            const resp = await logSource.fetchSearch({
                page: req.pageIdx,
                pageSize: req.pageSize,
            })
            return resp
        },
        { pageIdx: 0, pageSize: 15 },
    )

    return (
        <ListTable
            data={fetcher.data?.results ?? []}
            cols={[
                COLS.battleType,
                COLS.turns,
                COLS.duration,
                COLS.profit,
                COLS.date,
                COLS.status,
            ]}
            count={fetcher.data?.resultCount ?? 1}
            getId={(d) => d.id}
            pageIndex={fetcher.request.pageIdx}
            setPageIndex={(idx) => {
                fetcher.setRequest({
                    pageIdx: idx,
                    pageSize: fetcher.request.pageSize,
                })
            }}
            setPageSize={{
                options: [15, 50, 100, 1000],
                handler: (pageSize: number) => {
                    fetcher.setRequest({
                        pageIdx: 0,
                        pageSize: pageSize,
                    })
                },
            }}
            pageSize={fetcher.data?.pageSize ?? 1}
            selectedId=""
            setSelectedId={() => {}}
            sortCriteria={null}
            setSortCriteria={() => {}}
            rowUrl={(d) => `/logs/${d.id}`}
            isLoading={fetcher.isPending}
        />
    )
}

const COLS = {
    battleType: {
        id: "battleType",
        header: { content: "Type", className: "w-[6rem]" },
        align: "text-left",
        cell: (x) => ({
            content: humanizeBattleType(
                x.search.meta.battleType,
                x.search.meta.round?.max ?? null,
            ),
            className: "battleType",
        }),
    },
    turns: {
        id: "turns",
        header: { content: "Turns" },
        align: "text-right",
        cell: (x) => ({
            content: `${formatNumber(x.search.meta.turnIndices.length)} turns`,
            className: "turns",
        }),
    },
    duration: {
        id: "duration",
        header: { content: "Duration" },
        align: "text-right",
        cell: (x) => ({
            content: formatDuration(
                new Date(x.meta.start),
                new Date(x.meta.lastUpdate),
            ),
            className: "duration",
        }),
    },
    profit: {
        id: "profit",
        header: { content: "Profit" },
        // preprocess: (ids) => formatProfit(ids),
        cell: (x) => {
            const p = x.search.finances.profit

            return {
                content: Math.round(p / 1000) + "k",
                className: cn("profit", p > 0 ? "positive" : "negative"),
            }
        },
    },
    date: {
        id: "date",
        header: { content: "Start Date" },
        preprocess: (xs) => {
            const [now, setNow] = useState(new Date())

            useEffect(() => {
                const timerId = setInterval(() => {
                    setNow(new Date())
                }, 60_000)

                return () => clearInterval(timerId)
            })

            return xs.map(() => now)
        },
        cell: (x, now) => ({
            ...formatStartDate(x.meta.start, now),
            className: "date",
        }),
    } satisfies ListTable.Column<LogSearchResult, Date>,
    status: {
        id: "status",
        header: { content: "Status" },
        align: "text-center",
        cell: (x) => formatCompletionType(x),
    },
    // {
    //     id: "enchants",
    //     header: { content: "Enchants Unlocked", className: "pr-4" },
    //     align: "text-center",
    //     preprocess: (ids) => formatEnchants(ids),
    //     cell: ({ value }) => value.cell,
    // } as const satisfies ListTableColumn<
    //     ReturnType<typeof formatEnchants>[number]
    // >,
} as const satisfies Record<string, ListTable.Column<LogSearchResult, any>>

function formatDuration(start: Date, end: Date) {
    const elapsed = end.getTime() - start.getTime()
    const seconds = elapsed / 1000

    const ss = Math.trunc(seconds % 60)
        .toString()
        .padStart(2, "0")
    const mm = Math.trunc(seconds / 60).toString()

    const mmClassName = seconds < 60 ? "mm" : ""

    const result = (
        <span>
            <span className={mmClassName}>{mm}m </span>
            <span>{ss}s</span>
        </span>
    )

    return result
}

function formatStartDate(
    start: string | null,
    now: Date | null,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {},
) {
    if (!start) {
        return {
            content: "-",
        }
    }

    const d = new Date(start)
    now ??= new Date()

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
                `${d.getMinutes().toString().padStart(2, "0")}`,
            ].join(":") +
            " " +
            [
                `${d.getDate().toString().padStart(2, "0")}`,
                `${(d.getMonth() + 1).toString().padStart(2, "0")}`,
                `${d.getFullYear()}`,
            ].join("-")
    }

    return {
        content,
        title: start,
    }
}

function formatCompletionType(x: LogSearchResult) {
    const completionType = x.search.meta.completionType
    const round = x.search.meta.round

    let titleEl
    if (completionType !== "finish" && round) {
        if (completionType === "die") {
            titleEl = `Died on round ${round.end} / ${round.max}`
        } else if (completionType === "flee") {
            titleEl = `Flee on round ${round.end} / ${round.max}`
        }
    }

    let roundEl = round ? (
        <span>
            {round.end} / {round.max}
        </span>
    ) : (
        <></>
    )
    let statusEl = <></>
    switch (completionType) {
        case "finish":
            statusEl = (
                <span className="finish flex justify-center">
                    <CheckIcon className="flex" />
                </span>
            )
            // sortValue = "9_done"
            break
        case "die":
            statusEl = (
                <span className="die flex justify-center gap-1">
                    <span className="w-5">
                        <Skull2Icon />
                    </span>

                    {roundEl}
                </span>
            )
            // sortValue = "1_die"
            break
        case "flee":
            statusEl = (
                <span className="flee flex justify-center gap-1">
                    <span className="w-6">
                        <RunIcon />
                    </span>

                    {roundEl}
                </span>
            )
            // sortValue = "2_flee"
            break
        default:
            statusEl = (
                <span className="flex justify-center gap-1">
                    <span className="">???</span>

                    {roundEl}
                </span>
            )
            // sortValue = "3_unknown"
            break
    }

    return {
        content: statusEl,
        title: titleEl,
    }
}
