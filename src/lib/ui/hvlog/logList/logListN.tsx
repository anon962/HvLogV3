import {
    humanizeFightingType,
    MAGE_STYLES,
    MELEE_STYLES,
} from "@/lib/stats/combatStats"
import { humanizeBattleType } from "@/lib/stats/metaStats"
import { LOG_SOURCE } from "@/lib/db/logSource"
import { formatNumber, newContext, useAsync } from "@/lib/utils/miscUtils"
import { cn, range, sum } from "myutils"
import { useEffect, useMemo, useState } from "react"
import { IS_REMOTE } from "../../constants"
import { RunIcon, Skull2Icon } from "../../icons/misc"
import { CheckIcon } from "../../icons/tailwind"
import { ListTable } from "../../listTable"
import { UrlParamN } from "../router"
import { useLocalJsonState } from "../hooks"
import { LogSourceN } from "@/lib/db/logSourceN"

export namespace LogListN {
    export const COLS = {
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
                content: `${formatNumber(x.search.meta.turnCount)} turns`,
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
            align: "text-left",
            header: { content: IS_REMOTE ? "Date" : "Start Date" },
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
        } as const satisfies ListTable.Column<LogSourceN.SearchResult, Date>,
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
    } as const satisfies Record<
        string,
        ListTable.Column<LogSourceN.SearchResult, any>
    >

    export const SORT_IDS = new Set([COLS.turns.id, COLS.date.id] as const)

    const btA = (st: number, end?: number) =>
        end
            ? range(st, end + 1).map((id) => `arena challenge #${id}`)
            : [`arena challenge #${st}`]
    const btT = (st: number, end: number) =>
        range(st, end + 1).map((id) => `The Tower Floor ${id}`)
    export const BATTLE_TYPES = [
        { label: "Grindfest", ids: new Set(["Grindfest"]) },
        { label: "RE", ids: new Set(["random encounter"]) },
        { label: "Tower", ids: new Set(["Tower"]) },
        { label: "Item World", ids: new Set(["Item World"]) },
        { label: "SPL (A100)", ids: new Set([...btA(35)]) },
        { label: "PGC (A95)", ids: new Set([...btA(34)]) },
        { label: "DwD (A90)", ids: new Set([...btA(33)]) },
        { label: "A85 - A65", ids: new Set([...btA(26, 32)]) },
        { label: "A60 - A35", ids: new Set([...btA(17, 24)]) },
        { label: "A30 - A2", ids: new Set([...btA(0, 16)]) },
        { label: "RoB (TTT)", ids: new Set([...btA(112)]) },
        { label: "RoB (FSM)", ids: new Set([...btA(111)]) },
        { label: "RoB (Unicorn)", ids: new Set([...btA(110)]) },
        { label: "RoB (Real Life)", ids: new Set([...btA(109)]) },
        { label: "RoB (Nagato)", ids: new Set([...btA(108)]) },
        { label: "RoB (Asakura)", ids: new Set([...btA(107)]) },
        { label: "RoB (Asahina)", ids: new Set([...btA(106)]) },
        { label: "RoB (Konata)", ids: new Set([...btA(105)]) },
    ]
    type BattleType = (typeof BATTLE_TYPES)[number]

    export const STYLES = [
        { ...MAGE_STYLES["Dark Mage"] },
        { ...MAGE_STYLES["Holy Mage"] },
        { ...MAGE_STYLES["Wind Mage"] },
        { ...MAGE_STYLES["Elec Mage"] },
        { ...MAGE_STYLES["Fire Mage"] },
        { ...MAGE_STYLES["Cold Mage"] },
        { ...MELEE_STYLES["One-Handed"] },
        { ...MELEE_STYLES["Two-Handed"] },
        { ...MELEE_STYLES["Dual Wield"] },
        { ...MELEE_STYLES["Niten"] },
        { ...MELEE_STYLES["Bonk"] },
    ]

    export const COMPLETION_TYPES = [
        { id: "finish", label: "Finish" },
        { id: "flee", label: "Flee" },
        { id: "die", label: "Die" },
    ] as const

    export const ERRORS = [
        { id: "none", label: "(none)" },
        { id: "inconsistentBattleTypes", label: "battleType" },
        { id: "parsing", label: "parsing" },
        { id: "missingStart", label: "noStart" },
        { id: "missingEnd", label: "noEnd" },
        { id: "dupes", label: "dupes" },
        { id: "unknownSequence", label: "unkSeq" },
    ]

    export const PARAM_SCHEMA = {
        // Search options
        p: {
            type: "number",
            deser: (x) => (x !== null && x >= 1 ? x - 1 : 0),
        },
        n: {
            type: "number",
        },
        s: {
            type: "string",
            deser: (x) => (x && SORT_IDS.has(x as any) ? x : null),
        },
        desc: {
            type: "boolean",
        },
        id_user: {
            type: "string",
        },
        key_user: {
            type: "string",
        },
        // Filter options
        bt: {
            type: "bitmask",
            deser: (xs) =>
                new Set<BattleType["label"]>(
                    xs
                        .map((idx) => BATTLE_TYPES[idx]?.label)
                        .filter((x) => !!x),
                ),
        },
        ct: {
            type: "bitmask",
            deser: (xs) =>
                new Set<string>(
                    xs
                        .map((idx) => COMPLETION_TYPES[idx]?.id)
                        .filter((x) => !!x),
                ),
        },
        sp: {
            type: "bitmask",
            deser: (xs) =>
                new Set<string>(
                    xs.map((idx) => STYLES[idx]?.id).filter((x) => !!x),
                ),
        },
        ss: {
            type: "bitmask",
            deser: (xs) =>
                new Set<string>(
                    xs.map((idx) => STYLES[idx]?.id).filter((x) => !!x),
                ),
        },
        i: {
            type: "bitmask",
            deser: (xs) => {
                const hasYes = xs.includes(0)
                const hasNo = xs.includes(1)
                if (hasYes && hasNo) {
                    return "both" as const
                } else if (!hasYes && !hasNo) {
                    return "neither" as const
                } else if (hasYes) {
                    return "yes" as const
                } else {
                    return "no" as const
                }
            },
        },
        ds: {
            type: "date",
        },
        de: {
            type: "date",
        },
        e: {
            type: "bitmask",
            deser: (xs) =>
                new Set<string>(
                    xs.map((idx) => ERRORS[idx]?.label).filter((x) => !!x),
                ),
        },
        rmn: {
            type: "number",
        },
        rmx: {
            type: "number",
        },
    } as const satisfies UrlParamN.Schema

    export const ctx = newContext(() => {
        const [params, setParams] = UrlParamN.useUrlParams({
            schema: PARAM_SCHEMA,
        })

        const [pageSizeStorage, setPageSizeStorage] = useLocalJsonState(
            15,
            "hvlog_log_list_page_size",
        )

        const pageIdx = params["p"] ?? 0
        const pageSize = params["n"] ?? pageSizeStorage
        const sortCid = params["s"]
        const sortDesc = params["desc"]
        const battleType =
            params.bt.size > 0
                ? BATTLE_TYPES.filter((cat) => params["bt"].has(cat.label))
                : BATTLE_TYPES
        const primaryStyle =
            params.sp.size > 0
                ? STYLES.filter((style) => params["sp"].has(style.id))
                : STYLES
        const secondaryStyle =
            params.ss.size > 0
                ? STYLES.filter((style) => params["ss"].has(style.id))
                : STYLES
        const completionType =
            params.ct.size > 0
                ? COMPLETION_TYPES.filter((x) => params["ct"].has(x.id))
                : COMPLETION_TYPES
        const roundMin = params["rmn"]
        const roundMax = params["rmx"]
        const errors =
            params.e.size > 0
                ? ERRORS.filter((x) => params["e"].has(x.label))
                : ERRORS

        const request = useMemo(
            () =>
                ({
                    pageIdx,
                    pageSize,
                    idUser: params["id_user"],
                    keyUser: params["key_user"],
                    sortCriteria: sortCid
                        ? {
                              cid: sortCid,
                              order:
                                  sortDesc === true
                                      ? ("desc" as const)
                                      : ("asc" as const),
                          }
                        : null,
                    battleType:
                        battleType.length === BATTLE_TYPES.length
                            ? null
                            : battleType.flatMap((cat) => [...cat.ids]),
                    primaryStyle:
                        primaryStyle.length === STYLES.length
                            ? null
                            : primaryStyle.map((style) => style.id),
                    secondaryStyle:
                        secondaryStyle.length === STYLES.length
                            ? null
                            : secondaryStyle.map((style) => style.id),
                    isImperil:
                        params["i"] === "yes"
                            ? true
                            : params["i"] === "no"
                              ? false
                              : null,
                    startDate: params["ds"]?.toISOString() ?? null,
                    endDate: params["de"]?.toISOString() ?? null,
                    completionType:
                        completionType.length === COMPLETION_TYPES.length
                            ? null
                            : completionType.map((x) => x.id),
                    roundMin,
                    roundMax,
                    errors:
                        errors.length === ERRORS.length
                            ? null
                            : Object.fromEntries(
                                  errors.map(
                                      (x) => [x.id as any, true] as const,
                                  ),
                              ),
                }) as const,
            [
                pageIdx,
                pageSize,
                params["id_user"],
                params["key_user"],
                sortCid,
                sortDesc,
                battleType.join("|"),
                primaryStyle.join("|"),
                secondaryStyle.join("|"),
                params["i"],
                params["ds"]?.toISOString(),
                params["de"]?.toISOString(),
                completionType.join("|"),
                roundMin,
                roundMax,
                errors.join("|"),
            ],
        )
        useEffect(() => {
            fetcher.setRequest(request)
        }, [request])

        const logSource = LOG_SOURCE.useContext()
        const fetcher = useAsync(async (req) => {
            const get = (
                pageIdx: number,
                sortCriteria?: ListTable.SortCriteria,
            ) => {
                return logSource.fetchSearch({
                    ...req,
                    pageIdx,
                    sort: sortCriteria
                        ? {
                              type: sortCriteria.cid,
                              order: sortCriteria.order,
                          }
                        : req.sortCriteria
                          ? {
                                type: req.sortCriteria.cid as any,
                                order: req.sortCriteria.order,
                            }
                          : null,
                })
            }

            const resp = await get(req.pageIdx)

            const prefetch = async () => {
                await get(0)
                const lastPageIdx =
                    Math.ceil(resp.resultCount / resp.pageSize) - 1
                await get(lastPageIdx)

                for (let idx of range(req.pageIdx - 2, req.pageIdx + 2 + 1)) {
                    if (idx <= 0 || idx >= lastPageIdx - 2) {
                        continue
                    }

                    await get(idx)
                }

                for (const cid of LogListN.SORT_IDS) {
                    for (const order of ["desc", "asc"] as const) {
                        await get(req.pageIdx, {
                            cid,
                            order,
                        })
                    }
                }
            }
            prefetch()

            return resp
        }, request)

        useEffect(() => {
            if (!fetcher.data?.ttl) {
                return
            }

            const currReq = fetcher.request
            const refetchTimer = setTimeout(
                () => {
                    if (fetcher.request === currReq) {
                        fetcher.setRequest({ ...currReq })
                    }
                },
                fetcher.data.ttl * 2 * 1000,
            )

            return () => clearTimeout(refetchTimer)
        }, [fetcher.data, fetcher.request])

        return [
            {
                params,
                setParams,
                pageSizeStorage,
                setPageSizeStorage,
                fetcher,
                logSource,
            },
            () => {},
        ]
    })
}

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

function formatCompletionType(x: LogSourceN.SearchResult) {
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
