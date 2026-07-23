import { humanizeFightingType } from "@/lib/stats/combatStats"
import { humanizeBattleType } from "@/lib/stats/metaStats"
import { LOG_SOURCE, LogSearchResult } from "@/lib/ui/hvlog/logSource"
import { formatNumber, pushSearchParam, useAsync } from "@/lib/utils/miscUtils"
import { alphabeticalBy, cn, range, sort } from "myutils"
import { useEffect, useMemo, useState } from "react"
import { RunIcon, Skull2Icon } from "../icons/misc"
import { CheckIcon } from "../icons/tailwind"
import { ListTable } from "../listTable"
import { useLocalJsonState } from "./hooks"

export function LogList(props: {
    id_user: string | null
    key_user: string | null
}) {
    const [pageSizeStorage, setPageSizeStorage] = useLocalJsonState(
        15,
        "hvlog_log_list_page_size",
    )

    const windowHref = new URL(window.location.href)

    let pageIdx = parseInt(windowHref.searchParams.get("p") ?? "0")
    if (isNaN(pageIdx)) {
        pageIdx = 0
    } else {
        pageIdx -= 1
    }

    let pageSize = parseInt(windowHref.searchParams.get("n") ?? "")
    if (isNaN(pageSize) || pageSize <= 0) {
        pageSize = pageSizeStorage
    } else if (pageSizeStorage !== pageSize) {
        setPageSizeStorage(pageSize)
    }

    let [sortCriteria, setSortCriteria] =
        useState<ListTable.SortCriteria | null>(null)

    const s = windowHref.searchParams.get("s")
    const desc = parseInt(windowHref.searchParams.get("desc")!)
    if (SORT_IDS.has(s as any) && !isNaN(desc)) {
        const update = {
            cid: s!,
            order: desc > 0 ? "desc" : "asc",
        } as const
        if (
            update.cid !== sortCriteria?.cid ||
            update.order !== sortCriteria?.order
        ) {
            setSortCriteria(update)
            sortCriteria = update
        }
    }

    const logSource = LOG_SOURCE.useContext()
    const fetcher = useAsync(
        async (req) => {
            const get = (pageIdx: number) =>
                logSource.fetchSearch({
                    pageIdx,
                    pageSize: req.pageSize,
                    idUser: req.id_user,
                    keyUser: req.key_user,
                    sort: req.sortCriteria
                        ? {
                              type: req.sortCriteria.cid as any,
                              order: req.sortCriteria.order,
                          }
                        : null,
                })

            const resp = await get(req.pageIdx)

            // prefetch
            get(0)
            const lastPageIdx = Math.ceil(resp.resultCount / resp.pageSize) - 1
            get(lastPageIdx)

            for (let idx of range(req.pageIdx - 2, req.pageIdx + 2 + 1)) {
                if (idx <= 0 || idx >= lastPageIdx - 2) {
                    continue
                }

                get(idx)
            }

            return resp
        },
        {
            pageIdx,
            pageSize,
            id_user: props.id_user,
            key_user: props.key_user,
            sortCriteria,
        },
    )

    const sortedData = useMemo(() => {
        const results = fetcher.data?.results
        if (!sortCriteria?.order || !results?.length) {
            return results
        }

        switch (sortCriteria.cid) {
            case COLS.turns.id:
                return sort(
                    results,
                    (x) => x.search.meta.turnIndices.length,
                    sortCriteria.order === "desc",
                )
            case COLS.date.id:
                return alphabeticalBy(
                    results,
                    (x) => x.meta.start ?? "zzz",
                    sortCriteria.order === "desc",
                )
            default:
                console.error(sortCriteria)
        }
    }, [fetcher.data?.results, sortCriteria])

    return (
        <ListTable
            data={sortedData ?? []}
            cols={[
                COLS.battleType,
                COLS.turns,
                COLS.style,
                COLS.user,
                COLS.date,
                COLS.status,
            ]}
            count={fetcher.data?.resultCount ?? 1}
            getId={(d) => d.id}
            sortCols={new Set(SORT_IDS)}
            pageIndex={fetcher.request.pageIdx}
            setPageIndex={(idx) => {
                fetcher.setRequest({
                    ...fetcher.request,
                    pageIdx: idx,
                })
            }}
            setPageSize={{
                options: [15, 50, 100, 1000],
                handler: (pageSize: number) => {
                    setPageSizeStorage(pageSize)
                    fetcher.setRequest({
                        ...fetcher.request,
                        pageIdx: 0,
                        pageSize: pageSize,
                    })

                    pushSearchParam({
                        p: String(1),
                        n: String(pageSize),
                    })
                },
            }}
            pageSize={fetcher.data?.pageSize ?? 1}
            selectedId=""
            setSelectedId={() => {}}
            sortCriteria={sortCriteria}
            setSortCriteria={(crit) => {
                setSortCriteria(crit)

                fetcher.setRequest({
                    ...fetcher.request,
                    sortCriteria: crit,
                })

                if (crit) {
                    pushSearchParam({
                        s: String(crit.cid),
                        desc: crit.order === "desc" ? "1" : "0",
                    })
                } else {
                    pushSearchParam({
                        s: null,
                        desc: null,
                    })
                }
            }}
            rowUrl={(d) => `/logs/${d.id}`}
            isLoading={fetcher.isPending}
            className={{ root: "text-sm" }}
            pageUrl={(pageIdx) => ({
                p: String(pageIdx + 1),
                n: String(fetcher.request.pageSize),
                ...(fetcher.request.sortCriteria
                    ? {
                          s: String(fetcher.request.sortCriteria.cid),
                          desc:
                              fetcher.request.sortCriteria.order === "desc"
                                  ? "1"
                                  : "0",
                      }
                    : {}),
            })}
        />
    )
}

const COLS = {
    user: {
        id: "user",
        header: { content: "User" },
        align: "text-left",
        cell: (x) => ({
            content: x.meta.user_name ?? "(anonymous)",
            className: "user",
            title: x.meta.user_id ?? "",
        }),
    },
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
    } as const satisfies ListTable.Column<LogSearchResult, Date>,
    status: {
        id: "status",
        header: { content: "Status" },
        align: "text-center",
        cell: (x) => formatCompletionType(x),
    },
    style: {
        id: "style",
        header: { content: "Style" },
        align: "text-left",
        cell: (x) => ({
            content: humanizeFightingType(x.search.style),
            className: "style",
        }),
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

const SORT_IDS = new Set([COLS.turns.id, COLS.date.id] as const)

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
